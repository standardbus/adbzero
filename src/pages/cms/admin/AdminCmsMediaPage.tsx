import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/stores/i18nStore'
import { useAppStore } from '@/stores/appStore'
import { getProtectedMediaUrl, listCmsMediaAssets, uploadCmsMedia } from '@/services/cms-media'
import type { CmsMediaAsset } from '@/types/cms'

function emptyI18nMap() {
  const map: Record<string, string> = {}
  for (const lang of SUPPORTED_LANGUAGES) map[lang] = ''
  return map
}

export function AdminCmsMediaPage() {
  const { language, t } = useTranslation()
  const showToast = useAppStore((s) => s.showToast)
  const [items, setItems] = useState<CmsMediaAsset[]>([])
  const [uploading, setUploading] = useState(false)
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>('en')
  const [titleI18n, setTitleI18n] = useState<Record<string, string>>(emptyI18nMap())
  const [altI18n, setAltI18n] = useState<Record<string, string>>(emptyI18nMap())
  const [captionI18n, setCaptionI18n] = useState<Record<string, string>>(emptyI18nMap())
  const [creditI18n, setCreditI18n] = useState<Record<string, string>>(emptyI18nMap())
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  const loadMedia = useCallback(async () => {
    const rows = await listCmsMediaAssets()
    setItems(rows)
  }, [])

  useEffect(() => {
    loadMedia().catch((error) => {
      console.error(error)
      showToast({ type: 'error', title: t('cms.saveError'), message: t('cms.loadError') })
    })
  }, [loadMedia, showToast, t])

  useEffect(() => {
    let mounted = true
    const loadPreview = async () => {
      const imageItems = items.filter((i) => i.media_type === 'image').slice(0, 20)
      const pairs = await Promise.all(
        imageItems.map(async (item) => {
          const signedUrl = await getProtectedMediaUrl({ mediaId: item.id })
          return [item.id, signedUrl || ''] as const
        })
      )
      if (!mounted) return
      const next: Record<string, string> = {}
      for (const [id, url] of pairs) {
        if (url) next[id] = url
      }
      setPreviewUrls(next)
    }
    if (items.length > 0) {
      loadPreview().catch(() => {})
    }
    return () => {
      mounted = false
    }
  }, [items])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    setUploading(true)
    try {
      for (const file of acceptedFiles) {
        await uploadCmsMedia(file, {
          title_i18n: titleI18n,
          alt_i18n: altI18n,
          caption_i18n: captionI18n,
          credit_i18n: creditI18n,
        })
      }
      showToast({ type: 'success', title: t('cms.saved'), message: t('cms.mediaUploaded') })
      await loadMedia()
    } catch (error: any) {
      showToast({ type: 'error', title: t('cms.saveError'), message: error?.message || t('common.error') })
    } finally {
      setUploading(false)
    }
  }, [altI18n, captionI18n, creditI18n, loadMedia, showToast, t, titleI18n])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading
  })

  const currentAlt = useMemo(() => altI18n[activeLanguage] || '', [altI18n, activeLanguage])
  const currentTitle = useMemo(() => titleI18n[activeLanguage] || '', [titleI18n, activeLanguage])

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900 p-4 space-y-3">
        <h2 className="text-lg font-bold">{t('cms.mediaUpload')}</h2>

        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              type="button"
              key={lang}
              onClick={() => setActiveLanguage(lang)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                activeLanguage === lang ? 'bg-accent-500 text-white' : 'bg-surface-100 dark:bg-white/10'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={currentTitle}
            onChange={(e) => setTitleI18n((prev) => ({ ...prev, [activeLanguage]: e.target.value }))}
            placeholder={t('cms.mediaTitle')}
            className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
          />
          <input
            value={currentAlt}
            onChange={(e) => setAltI18n((prev) => ({ ...prev, [activeLanguage]: e.target.value }))}
            placeholder={t('cms.mediaAlt')}
            className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
          />
          <input
            value={captionI18n[activeLanguage] || ''}
            onChange={(e) => setCaptionI18n((prev) => ({ ...prev, [activeLanguage]: e.target.value }))}
            placeholder={t('cms.mediaCaption')}
            className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
          />
          <input
            value={creditI18n[activeLanguage] || ''}
            onChange={(e) => setCreditI18n((prev) => ({ ...prev, [activeLanguage]: e.target.value }))}
            placeholder={t('cms.mediaCredit')}
            className="px-3 py-2 rounded-lg border border-surface-200 dark:border-white/10 bg-transparent"
          />
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-accent-500 bg-accent-500/5' : 'border-surface-300 dark:border-white/20'
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-sm text-surface-500">{uploading ? t('cms.uploading') : t('cms.dropzone')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900 overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-surface-500 border-b border-surface-200 dark:border-white/10">
          <div className="col-span-2">{t('cms.preview')}</div>
          <div className="col-span-4">{t('cms.path')}</div>
          <div className="col-span-2">{t('cms.type')}</div>
          <div className="col-span-2">{t('cms.size')}</div>
          <div className="col-span-2">{t('cms.id')}</div>
        </div>
        {items.length === 0 ? (
          <div className="p-4 text-surface-500">{t('cms.noMedia')}</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-surface-200/70 dark:border-white/5 items-center">
              <div className="col-span-2">
                {item.media_type === 'image' && previewUrls[item.id] ? (
                  <img src={previewUrls[item.id]} alt={item.alt_i18n?.[language] || ''} className="w-16 h-12 object-cover rounded" />
                ) : (
                  <span className="text-xs text-surface-500">-</span>
                )}
              </div>
              <div className="col-span-4 text-xs font-mono break-all">{item.storage_path}</div>
              <div className="col-span-2 text-sm">{item.media_type}</div>
              <div className="col-span-2 text-sm">{Math.round(item.size_bytes / 1024)} KB</div>
              <div className="col-span-2 text-xs font-mono break-all">{item.id}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

