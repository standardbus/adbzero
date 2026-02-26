import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ConnectLanding } from '@/components/connect/ConnectLanding'
import { CmsPublicLayout } from '@/components/cms/CmsPublicLayout'
import { CmsSeo } from '@/components/cms/CmsSeo'
import { fetchHomepageContent } from '@/services/cms'
import { createDefaultConnectHomeTemplate, decodeConnectTemplateWithFallback } from '@/lib/connect-template'
import { CONNECT_CAROUSEL_IMAGES, buildConnectCarouselJsonLd, toAbsolutePublicUrl } from '@/lib/connect-carousel-seo'
import type { CmsLocalizedContent } from '@/types/cms'
import { useTranslation } from '@/stores/i18nStore'
import { useAdbStore } from '@/stores/adbStore'

export function HomePage() {
  const { language, t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isConnected = useAdbStore((state) => state.isConnected)
  const isDemoMode = useAdbStore((state) => state.isDemoMode)
  const [content, setContent] = useState<CmsLocalizedContent | null>(null)
  const [loading, setLoading] = useState(true)
  const defaultTemplate = useMemo(
    () => createDefaultConnectHomeTemplate((key, params) => t(key, params as Record<string, any>)),
    [t]
  )

  useEffect(() => {
    if (isConnected || isDemoMode) {
      navigate('/app', { replace: true })
    }
  }, [isConnected, isDemoMode, navigate])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchHomepageContent(language)
        if (mounted) setContent(data)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [language])

  const title = content?.translation?.seo_title || content?.translation?.title || t('cms.defaultHomeTitle')
  const description = content?.translation?.seo_description || content?.translation?.excerpt || t('cms.defaultHomeDescription')
  const keywords = useMemo(() => {
    const imageKeywords = Array.from(
      new Set(CONNECT_CAROUSEL_IMAGES.flatMap((image) => image.seoTags))
    ).join(', ')
    return content?.translation?.seo_keywords || imageKeywords
  }, [content?.translation?.seo_keywords])
  const ogImage = useMemo(
    () => toAbsolutePublicUrl(CONNECT_CAROUSEL_IMAGES[0]?.src || '/adbzero_logo.webp'),
    []
  )
  const jsonLd = useMemo(() => {
    const cmsJsonLd = content?.translation?.json_ld
    const galleryJsonLd = buildConnectCarouselJsonLd()

    if (!cmsJsonLd || Object.keys(cmsJsonLd).length === 0) {
      return galleryJsonLd
    }

    return {
      '@context': 'https://schema.org',
      '@graph': [cmsJsonLd, galleryJsonLd]
    }
  }, [content?.translation?.json_ld])
  const connectTemplate = useMemo(
    () => decodeConnectTemplateWithFallback(content?.translation?.body_json, defaultTemplate),
    [content?.translation?.body_json, defaultTemplate]
  )
  const showConnectRequiredNotice = searchParams.get('connect_required') === '1'

  return (
    <CmsPublicLayout>
      <CmsSeo
        title={title}
        description={description}
        keywords={keywords}
        canonicalUrl={content?.translation?.seo_canonical_url || window.location.href}
        ogTitle={content?.translation?.og_title}
        ogDescription={content?.translation?.og_description}
        ogImage={ogImage}
        twitterTitle={content?.translation?.twitter_title}
        twitterDescription={content?.translation?.twitter_description}
        jsonLd={jsonLd}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {showConnectRequiredNotice ? (
          <div className="rounded-xl border border-amber-400/40 bg-amber-100/80 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 p-4 text-sm">
            <p className="font-semibold">{t('cms.connectRequiredTitle')}</p>
            <p className="opacity-90 mt-1">{t('cms.connectRequiredDesc')}</p>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-surface-500">{t('common.loading')}</div>
      ) : (
        <ConnectLanding mode="cms" template={connectTemplate} />
      )}
    </CmsPublicLayout>
  )
}
