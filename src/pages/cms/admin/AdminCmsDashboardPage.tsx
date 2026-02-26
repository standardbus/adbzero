import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { deleteCmsContent, ensureAdminHomepageContent, listAdminContents } from '@/services/cms'
import type { CmsLocalizedContent, CmsStatus } from '@/types/cms'
import { useTranslation } from '@/stores/i18nStore'
import { useAppStore } from '@/stores/appStore'

function getPublicContentPath(item: CmsLocalizedContent): string {
  if (item.is_homepage) return '/'
  if (item.content_type === 'page') return `/${item.slug}`
  return `/blog/${item.slug}`
}

export function AdminCmsDashboardPage() {
  const { language, t } = useTranslation()
  const showToast = useAppStore((s) => s.showToast)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CmsLocalizedContent[]>([])
  const [homepageId, setHomepageId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<CmsStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        let ensuredHomepageId: string | null = null
        try {
          const homepage = await ensureAdminHomepageContent(language)
          ensuredHomepageId = homepage.id
        } catch (error) {
          console.warn('Unable to ensure homepage content', error)
        }

        const data = await listAdminContents(language)
        if (mounted) {
          setItems(data)
          setHomepageId(ensuredHomepageId || data.find((item) => item.is_homepage)?.id || null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [language])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      const statusMatch = statusFilter === 'all' || item.status === statusFilter
      if (!statusMatch) return false
      if (!term) return true
      return (
        item.slug.toLowerCase().includes(term) ||
        (item.translation?.title || '').toLowerCase().includes(term)
      )
    })
  }, [items, search, statusFilter])

  const handleDelete = async (item: CmsLocalizedContent) => {
    if (item.is_homepage) {
      showToast({
        type: 'warning',
        title: t('common.warning'),
        message: t('cms.deleteHomepageBlocked')
      })
      return
    }

    if (!window.confirm(t('cms.deleteConfirm'))) {
      return
    }

    setDeletingId(item.id)
    try {
      await deleteCmsContent(item.id)
      setItems((prev) => prev.filter((entry) => entry.id !== item.id))
      showToast({
        type: 'success',
        title: t('common.success'),
        message: t('cms.deleteSuccess')
      })
    } catch (error: any) {
      console.error('CMS delete error', error)
      showToast({
        type: 'error',
        title: t('cms.deleteError'),
        message: error?.message || t('common.error')
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'draft', 'published', 'archived'] as const).map((status) => (
            <button
              type="button"
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                statusFilter === status ? 'bg-accent-500 text-white' : 'bg-surface-100 dark:bg-white/10'
              }`}
            >
              {status === 'all' ? t('common.all') : t(`cms.status_${status}`)}
            </button>
          ))}
          {homepageId ? (
            <Link
              to={`/app/admin/cms/editor/${homepageId}`}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              {t('cms.editHomepage')}
            </Link>
          ) : null}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('cms.searchPlaceholder')}
          className="w-full md:w-72 px-3 py-2 rounded-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/10"
        />
      </div>

      <div className="rounded-2xl border border-surface-200 dark:border-white/10 overflow-hidden bg-white dark:bg-surface-900">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-surface-500 border-b border-surface-200 dark:border-white/10">
          <div className="col-span-4">{t('cms.title')}</div>
          <div className="col-span-2">{t('cms.type')}</div>
          <div className="col-span-2">{t('cms.visibility')}</div>
          <div className="col-span-1">{t('cms.status')}</div>
          <div className="col-span-1">{t('cms.updated')}</div>
          <div className="col-span-2 text-right">{t('cms.actions')}</div>
        </div>

        {loading ? (
          <div className="p-4 text-surface-500">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-surface-500">{t('cms.noContents')}</div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-surface-200/70 dark:border-white/5 hover:bg-surface-100/70 dark:hover:bg-white/5 transition-colors"
            >
              <div className="col-span-4">
                <Link
                  to={`/app/admin/cms/editor/${item.id}`}
                  className="font-semibold hover:underline underline-offset-4"
                >
                  {item.translation?.title || item.slug}
                </Link>
                <p className="text-xs text-surface-500">/{item.slug}</p>
                {item.is_homepage ? (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{t('cms.isHomepage')}</p>
                ) : null}
              </div>
              <div className="col-span-2 text-sm capitalize">{item.content_type}</div>
              <div className="col-span-2 text-sm">{t(`cms.visibility_${item.visibility}`)}</div>
              <div className="col-span-1 text-sm">{t(`cms.status_${item.status}`)}</div>
              <div className="col-span-1 text-xs text-surface-500">{format(new Date(item.updated_at), 'yyyy-MM-dd HH:mm')}</div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <Link
                  to={getPublicContentPath(item)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 rounded-md text-xs font-semibold bg-indigo-500 text-white"
                  title={getPublicContentPath(item)}
                >
                  {t('cms.preview')}
                </Link>
                <Link
                  to={`/app/admin/cms/editor/${item.id}`}
                  className="px-2 py-1 rounded-md text-xs font-semibold bg-surface-200 dark:bg-white/10"
                >
                  {t('common.edit')}
                </Link>
                <button
                  type="button"
                  disabled={item.is_homepage || deletingId === item.id}
                  onClick={() => handleDelete(item)}
                  className="px-2 py-1 rounded-md text-xs font-semibold bg-rose-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === item.id ? t('cms.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
