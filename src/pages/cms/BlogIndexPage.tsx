import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { CmsPublicLayout } from '@/components/cms/CmsPublicLayout'
import { CmsSeo } from '@/components/cms/CmsSeo'
import { fetchBlogList, listCmsTaxonomies } from '@/services/cms'
import { CmsLocalizedContent, CmsTaxonomy } from '@/types/cms'
import { useTranslation } from '@/stores/i18nStore'
import { CmsSocialLinks } from '@/components/cms/CmsSocialLinks'

const BLOG_PAGE_SIZE = 12

export function BlogIndexPage() {
  const { language, t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CmsLocalizedContent[]>([])
  const [total, setTotal] = useState(0)
  const [taxonomies, setTaxonomies] = useState<CmsTaxonomy[]>([])

  const typeFilter = (searchParams.get('type') as 'news' | 'tutorial' | null) ?? null
  const taxonomyFilter = searchParams.get('taxonomy') || null
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const offset = (page - 1) * BLOG_PAGE_SIZE

  useEffect(() => {
    let mounted = true
    const loadTaxonomies = async () => {
      const rows = await listCmsTaxonomies()
      if (mounted) setTaxonomies(rows)
    }
    loadTaxonomies().catch(() => { })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchBlogList({
          language,
          type: typeFilter,
          taxonomySlug: taxonomyFilter,
          limit: BLOG_PAGE_SIZE,
          offset
        })
        if (mounted) {
          setItems(data.items)
          setTotal(data.total)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [language, offset, taxonomyFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE))
  const updateFilters = (next: { type?: 'news' | 'tutorial' | null; taxonomy?: string | null }) => {
    const params = new URLSearchParams(searchParams)
    if (next.type !== undefined) {
      if (next.type) params.set('type', next.type)
      else params.delete('type')
    }
    if (next.taxonomy !== undefined) {
      if (next.taxonomy) params.set('taxonomy', next.taxonomy)
      else params.delete('taxonomy')
    }
    params.set('page', '1')
    setSearchParams(params)
  }

  return (
    <CmsPublicLayout>
      <CmsSeo
        title={t('cms.blogTitle')}
        description={t('cms.blogDescription')}
        canonicalUrl={window.location.href}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: t('cms.blogTitle'),
          description: t('cms.blogDescription'),
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight">{t('cms.blog')}</h1>
            <p className="text-surface-500 mt-2">{t('cms.blogDescription')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateFilters({ type: null })}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${!typeFilter ? 'bg-accent-500 text-white' : 'bg-surface-100 dark:bg-white/10'
                }`}
            >
              {t('common.all')}
            </button>
            <button
              type="button"
              onClick={() => updateFilters({ type: 'news' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${typeFilter === 'news' ? 'bg-accent-500 text-white' : 'bg-surface-100 dark:bg-white/10'
                }`}
            >
              {t('cms.news')}
            </button>
            <button
              type="button"
              onClick={() => updateFilters({ type: 'tutorial' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${typeFilter === 'tutorial' ? 'bg-accent-500 text-white' : 'bg-surface-100 dark:bg-white/10'
                }`}
            >
              {t('cms.tutorials')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => updateFilters({ taxonomy: null })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!taxonomyFilter ? 'bg-accent-500 text-white' : 'bg-surface-100 dark:bg-white/10'
              }`}
          >
            {t('common.all')}
          </button>
          {taxonomies.map((taxonomy) => (
            <button
              type="button"
              key={taxonomy.id}
              onClick={() => updateFilters({ taxonomy: taxonomy.slug })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${taxonomyFilter === taxonomy.slug
                ? 'bg-accent-500 text-white'
                : 'bg-surface-100 dark:bg-white/10'
                }`}
            >
              {taxonomy.name_i18n[language] || taxonomy.name_i18n.en || taxonomy.slug}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-surface-500">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-surface-200 dark:border-white/10 p-6">
            {t('cms.noPosts')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/blog/${item.slug}`}
                className="rounded-2xl border border-surface-200 dark:border-white/10 p-5 bg-white dark:bg-surface-900 hover:border-accent-500/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-accent-500">
                    {item.content_type === 'news' ? t('cms.news') : t('cms.tutorial')}
                  </span>
                  <span className="text-xs text-surface-500">
                    {item.publish_at ? format(new Date(item.publish_at), 'yyyy-MM-dd') : ''}
                  </span>
                </div>
                <h2 className="text-lg font-bold tracking-tight line-clamp-2">
                  {item.translation?.title || item.slug}
                </h2>
                <p className="text-sm text-surface-500 mt-2 line-clamp-3">
                  {item.translation?.excerpt || t('cms.noExcerpt')}
                </p>
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              const next = Math.max(1, page - 1)
              const params = new URLSearchParams(searchParams)
              params.set('page', String(next))
              setSearchParams(params)
            }}
            className="px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-white/10 disabled:opacity-50"
          >
            {t('cms.prev')}
          </button>
          <span className="text-sm text-surface-500">{page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              const next = Math.min(totalPages, page + 1)
              const params = new URLSearchParams(searchParams)
              params.set('page', String(next))
              setSearchParams(params)
            }}
            className="px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-white/10 disabled:opacity-50"
          >
            {t('cms.next')}
          </button>
        </div>

        {/* Social Links Section */}
        <div className="pt-12 mt-12 border-t border-surface-200 dark:border-white/10 flex justify-center">
          <CmsSocialLinks />
        </div>
      </div>
    </CmsPublicLayout>
  )
}
