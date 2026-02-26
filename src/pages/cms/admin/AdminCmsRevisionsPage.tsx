import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { listAdminContents, listCmsRevisions } from '@/services/cms'
import type { CmsLocalizedContent, CmsRevision } from '@/types/cms'
import { useTranslation } from '@/stores/i18nStore'

export function AdminCmsRevisionsPage() {
  const { language, t } = useTranslation()
  const [contents, setContents] = useState<CmsLocalizedContent[]>([])
  const [selectedContentId, setSelectedContentId] = useState<string>('')
  const [revisions, setRevisions] = useState<CmsRevision[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const rows = await listAdminContents(language)
        if (!mounted) return
        setContents(rows)
        const firstId = rows[0]?.id || ''
        setSelectedContentId(firstId)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load().catch(() => setLoading(false))
    return () => {
      mounted = false
    }
  }, [language])

  useEffect(() => {
    let mounted = true
    const loadRevisions = async () => {
      if (!selectedContentId) {
        setRevisions([])
        return
      }
      const rows = await listCmsRevisions(selectedContentId)
      if (mounted) setRevisions(rows)
    }
    loadRevisions().catch(() => setRevisions([]))
    return () => {
      mounted = false
    }
  }, [selectedContentId])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900 p-4">
        <label className="text-xs uppercase tracking-wide text-surface-500">{t('cms.selectContent')}</label>
        <select
          value={selectedContentId}
          onChange={(e) => setSelectedContentId(e.target.value)}
          className="w-full mt-2 px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
        >
          {contents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.translation?.title || item.slug}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-surface-200 dark:border-white/10 overflow-hidden bg-white dark:bg-surface-900">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-surface-500 border-b border-surface-200 dark:border-white/10">
          <div className="col-span-2">{t('cms.language')}</div>
          <div className="col-span-2">{t('cms.revision')}</div>
          <div className="col-span-4">{t('cms.changeNote')}</div>
          <div className="col-span-4">{t('cms.updated')}</div>
        </div>

        {loading ? (
          <div className="p-4 text-surface-500">{t('common.loading')}</div>
        ) : revisions.length === 0 ? (
          <div className="p-4 text-surface-500">{t('cms.noRevisions')}</div>
        ) : (
          revisions.map((rev) => (
            <div key={rev.id} className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-surface-200/70 dark:border-white/5">
              <div className="col-span-2 uppercase">{rev.language}</div>
              <div className="col-span-2">#{rev.revision_number}</div>
              <div className="col-span-4">{rev.change_note || '-'}</div>
              <div className="col-span-4 text-sm text-surface-500">{format(new Date(rev.created_at), 'yyyy-MM-dd HH:mm:ss')}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

