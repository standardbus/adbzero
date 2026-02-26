import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { CmsPublicLayout } from '@/components/cms/CmsPublicLayout'
import { CmsSeo } from '@/components/cms/CmsSeo'
import { fetchBlogPostBySlug, resolveCmsSlugAccess } from '@/services/cms'
import { sanitizeCmsHtml } from '@/lib/cms-sanitize'
import { resolveMediaTokensInHtml } from '@/services/cms-media'
import { CmsLocalizedContent } from '@/types/cms'
import { useTranslation } from '@/stores/i18nStore'
import { useAuthStore } from '@/stores/authStore'
import { CmsSocialLinks } from '@/components/cms/CmsSocialLinks'

export function BlogDetailPage() {
  const { slug = '' } = useParams()
  const { language, t } = useTranslation()
  const { isAuthenticated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState<CmsLocalizedContent | null>(null)
  const [accessState, setAccessState] = useState<'public' | 'auth_required' | 'forbidden' | 'not_found'>('not_found')
  const [resolvedHtml, setResolvedHtml] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchBlogPostBySlug(slug, language)
        if (data) {
          if (mounted) {
            setPost(data)
            setAccessState('public')
          }
        } else {
          const access = await resolveCmsSlugAccess(slug)
          if (mounted) {
            setPost(null)
            setAccessState(access)
          }
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [language, slug])

  useEffect(() => {
    let mounted = true
    const resolveHtml = async () => {
      const raw = post?.translation?.body_html || ''
      if (!raw || !post?.slug) {
        if (mounted) setResolvedHtml(raw)
        return
      }
      const withMedia = await resolveMediaTokensInHtml(raw, post.slug)
      if (mounted) setResolvedHtml(withMedia)
    }
    resolveHtml().catch(() => setResolvedHtml(post?.translation?.body_html || ''))
    return () => {
      mounted = false
    }
  }, [post?.slug, post?.translation?.body_html])

  const safeHtml = useMemo(() => sanitizeCmsHtml(resolvedHtml), [resolvedHtml])
  const seoTitle = post?.translation?.seo_title || post?.translation?.title || t('cms.blog')
  const seoDescription = post?.translation?.seo_description || post?.translation?.excerpt || t('cms.blogDescription')

  return (
    <CmsPublicLayout>
      <CmsSeo
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={post?.translation?.seo_canonical_url || window.location.href}
        ogTitle={post?.translation?.og_title}
        ogDescription={post?.translation?.og_description}
        twitterTitle={post?.translation?.twitter_title}
        twitterDescription={post?.translation?.twitter_description}
        jsonLd={post?.translation?.json_ld || {
          '@context': 'https://schema.org',
          '@type': post?.content_type === 'tutorial' ? 'HowTo' : 'BlogPosting',
          headline: post?.translation?.title || '',
          description: post?.translation?.excerpt || '',
          datePublished: post?.publish_at || undefined,
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {loading ? (
          <div className="text-surface-500">{t('common.loading')}</div>
        ) : post?.translation ? (
          <article className="space-y-5">
            <Link to="/blog" className="text-sm text-accent-500 hover:underline">
              {t('cms.backToBlog')}
            </Link>
            <div className="flex items-center gap-3 text-xs text-surface-500">
              <span className="px-2 py-1 rounded bg-surface-100 dark:bg-white/10 uppercase font-semibold tracking-wide">
                {post.content_type === 'tutorial' ? t('cms.tutorial') : t('cms.news')}
              </span>
              <span>{post.publish_at ? format(new Date(post.publish_at), 'yyyy-MM-dd HH:mm') : ''}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{post.translation.title}</h1>
            {post.translation.excerpt ? (
              <p className="text-lg text-surface-600 dark:text-surface-300">{post.translation.excerpt}</p>
            ) : null}
            <div
              className="prose dark:prose-invert max-w-none prose-headings:tracking-tight"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />

            {/* Social Links Section */}
            <div className="pt-12 mt-12 border-t border-surface-200 dark:border-white/10 flex justify-center">
              <CmsSocialLinks />
            </div>
          </article>
        ) : accessState === 'auth_required' && !isAuthenticated ? (
          <div className="rounded-2xl border border-surface-200 dark:border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-2">{t('cms.authRequiredTitle')}</h2>
            <p className="text-surface-500 mb-4">{t('cms.authRequiredDesc')}</p>
            <Link to="/app" className="px-4 py-2 rounded-lg bg-accent-500 text-white inline-flex">
              {t('cms.openApp')}
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-surface-200 dark:border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-2">{t('cms.notFoundTitle')}</h2>
            <p className="text-surface-500 mb-4">{t('cms.notFoundDesc')}</p>
            <Link to="/blog" className="text-accent-500 hover:underline">{t('cms.backToBlog')}</Link>
          </div>
        )}
      </div>
    </CmsPublicLayout>
  )
}
