import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const distIndexPath = path.join(distDir, 'index.html')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SITE_URL = process.env.SITE_URL || 'https://example.com'

function escapeHtml(input = '') {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function chooseTranslation(translations = []) {
  return (
    translations.find((t) => t.language === 'en') ||
    translations[0] ||
    null
  )
}

function withSeoMeta(template, meta) {
  const title = escapeHtml(meta.title || 'ADB Zero')
  const description = escapeHtml(meta.description || 'ADBZero/0')
  const canonical = escapeHtml(meta.canonical || SITE_URL)

  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
  if (/<meta\s+name="description"/i.test(html)) {
    html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}" />`)
  } else {
    html = html.replace('</head>', `  <meta name="description" content="${description}" />\n</head>`)
  }

  const canonicalTag = `<link rel="canonical" href="${canonical}" />`
  if (/<link\s+rel="canonical"/i.test(html)) {
    html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, canonicalTag)
  } else {
    html = html.replace('</head>', `  ${canonicalTag}\n</head>`)
  }

  return html
}

async function writeRouteHtml(routePath, html) {
  if (routePath === '/') {
    await fs.writeFile(distIndexPath, html, 'utf8')
    return
  }

  const normalized = routePath.replace(/^\/+/, '')
  const targetDir = path.join(distDir, normalized)
  await fs.mkdir(targetDir, { recursive: true })
  await fs.writeFile(path.join(targetDir, 'index.html'), html, 'utf8')
}

function buildSitemap(urls) {
  const items = urls
    .map((url) => `<url><loc>${escapeHtml(url)}</loc></url>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>\n`
}

function buildRss(posts) {
  const items = posts.map((post) => {
    const title = escapeHtml(post.title || post.slug)
    const description = escapeHtml(post.description || '')
    const link = `${SITE_URL}/blog/${post.slug}`
    const pubDate = new Date(post.publish_at).toUTCString()
    return `<item><title>${title}</title><description>${description}</description><link>${link}</link><guid>${link}</guid><pubDate>${pubDate}</pubDate></item>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>ADB Zero Blog</title><link>${escapeHtml(SITE_URL)}</link><description>ADB Zero news and tutorials</description>${items}</channel></rss>\n`
}

async function main() {
  const indexTemplate = await fs.readFile(distIndexPath, 'utf8')

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    await fs.writeFile(path.join(distDir, 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8')
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const nowIso = new Date().toISOString()
  const { data: contents, error } = await supabase
    .from('cms_contents')
    .select('slug,content_type,is_homepage,publish_at,cms_content_i18n(language,title,excerpt,seo_title,seo_description)')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .lte('publish_at', nowIso)

  if (error) {
    throw error
  }

  const rows = contents || []
  const routes = new Map()

  for (const row of rows) {
    const tr = chooseTranslation(row.cms_content_i18n || [])
    const baseMeta = {
      title: tr?.seo_title || tr?.title || row.slug,
      description: tr?.seo_description || tr?.excerpt || '',
    }

    if (row.is_homepage) {
      routes.set('/', {
        ...baseMeta,
        canonical: `${SITE_URL}/`,
      })
      continue
    }

    if (row.content_type === 'news' || row.content_type === 'tutorial') {
      routes.set(`/blog/${row.slug}`, {
        ...baseMeta,
        canonical: `${SITE_URL}/blog/${row.slug}`,
      })
    } else {
      routes.set(`/${row.slug}`, {
        ...baseMeta,
        canonical: `${SITE_URL}/${row.slug}`,
      })
    }
  }

  if (!routes.has('/')) {
    routes.set('/', {
      title: 'ADB Zero',
      description: 'ADBZero/0 homepage',
      canonical: `${SITE_URL}/`,
    })
  }

  routes.set('/blog', {
    title: 'ADB Zero Blog',
    description: 'Latest news and tutorials',
    canonical: `${SITE_URL}/blog`,
  })

  for (const [routePath, meta] of routes.entries()) {
    const html = withSeoMeta(indexTemplate, meta)
    await writeRouteHtml(routePath, html)
  }

  const sitemapUrls = [...routes.keys()]
    .map((routePath) => `${SITE_URL}${routePath === '/' ? '' : routePath}`)
    .sort()

  const blogPosts = rows
    .filter((row) => row.content_type === 'news' || row.content_type === 'tutorial')
    .map((row) => {
      const tr = chooseTranslation(row.cms_content_i18n || [])
      return {
        slug: row.slug,
        title: tr?.title || row.slug,
        description: tr?.excerpt || '',
        publish_at: row.publish_at || nowIso,
      }
    })
    .sort((a, b) => (a.publish_at > b.publish_at ? -1 : 1))

  await fs.writeFile(path.join(distDir, 'sitemap.xml'), buildSitemap(sitemapUrls), 'utf8')
  await fs.writeFile(path.join(distDir, 'rss.xml'), buildRss(blogPosts), 'utf8')
  await fs.writeFile(path.join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8')
}

main().catch((error) => {
  console.error('[prerender-cms] failed:', error)
  process.exitCode = 1
})

