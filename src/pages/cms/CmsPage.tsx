import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CmsPublicLayout } from '@/components/cms/CmsPublicLayout'
import { CmsSeo } from '@/components/cms/CmsSeo'
import { fetchCmsPageBySlug, resolveCmsSlugAccess } from '@/services/cms'
import { sanitizeCmsHtml } from '@/lib/cms-sanitize'
import { resolveMediaTokensInHtml } from '@/services/cms-media'
import type { CmsLocalizedContent } from '@/types/cms'
import { useTranslation } from '@/stores/i18nStore'
import { useAuthStore } from '@/stores/authStore'

export function CmsPage() {
  const { slug = '' } = useParams()
  const { language, t } = useTranslation()
  const { isAuthenticated, isAdmin } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<CmsLocalizedContent | null>(null)
  const [accessState, setAccessState] = useState<'public' | 'auth_required' | 'forbidden' | 'not_found'>('not_found')
  const [resolvedHtml, setResolvedHtml] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchCmsPageBySlug(slug, language)
        if (data) {
          if (mounted) {
            setPage(data)
            setAccessState('public')
          }
        } else {
          const access = await resolveCmsSlugAccess(slug)
          if (mounted) {
            setPage(null)
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
  }, [slug, language])

  useEffect(() => {
    let mounted = true
    const resolveHtml = async () => {
      const raw = page?.translation?.body_html || ''
      if (!raw || !page?.slug) {
        if (mounted) setResolvedHtml(raw)
        return
      }
      const withMedia = await resolveMediaTokensInHtml(raw, page.slug)
      if (mounted) setResolvedHtml(withMedia)
    }
    resolveHtml().catch(() => setResolvedHtml(page?.translation?.body_html || ''))
    return () => {
      mounted = false
    }
  }, [page?.slug, page?.translation?.body_html])

  const safeHtml = useMemo(() => sanitizeCmsHtml(resolvedHtml), [resolvedHtml])

  if (loading) {
    return (
      <CmsPublicLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-surface-500">{t('common.loading')}</div>
      </CmsPublicLayout>
    )
  }

  if (page?.translation) {
    return (
      <CmsPublicLayout>
        <CmsSeo
          title={page.translation.seo_title || page.translation.title}
          description={page.translation.seo_description || page.translation.excerpt}
          canonicalUrl={page.translation.seo_canonical_url || window.location.href}
          ogTitle={page.translation.og_title}
          ogDescription={page.translation.og_description}
          twitterTitle={page.translation.twitter_title}
          twitterDescription={page.translation.twitter_description}
          jsonLd={page.translation.json_ld}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <article className="space-y-5">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{page.translation.title}</h1>
            {page.translation.excerpt ? (
              <p className="text-lg text-surface-600 dark:text-surface-300">{page.translation.excerpt}</p>
            ) : null}
            <div
              className="prose dark:prose-invert max-w-none prose-headings:tracking-tight"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          </article>
        </div>
      </CmsPublicLayout>
    )
  }

  if (accessState === 'auth_required' && !isAuthenticated) {
    return (
      <CmsPublicLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <div className="rounded-2xl border border-surface-200 dark:border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-2">{t('cms.authRequiredTitle')}</h2>
            <p className="text-surface-500 mb-4">{t('cms.authRequiredDesc')}</p>
            <Link to="/app" className="px-4 py-2 rounded-lg bg-accent-500 text-white inline-flex">
              {t('cms.openApp')}
            </Link>
          </div>
        </div>
      </CmsPublicLayout>
    )
  }

  if (accessState === 'forbidden' && !isAdmin) {
    return (
      <CmsPublicLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <div className="rounded-2xl border border-surface-200 dark:border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-2">{t('cms.notFoundTitle')}</h2>
            <p className="text-surface-500">{t('cms.notFoundDesc')}</p>
          </div>
        </div>
      </CmsPublicLayout>
    )
  }

  return (
    <CmsPublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-surface-200 dark:border-white/10 p-8">
          <h2 className="text-2xl font-bold mb-2">{t('cms.notFoundTitle')}</h2>
          <p className="text-surface-500">{t('cms.notFoundDesc')}</p>
        </div>
      </div>
    </CmsPublicLayout>
  )
}
