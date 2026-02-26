import { Link } from 'react-router-dom'
import { CmsPublicLayout } from '@/components/cms/CmsPublicLayout'
import { useTranslation } from '@/stores/i18nStore'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <CmsPublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-surface-200 dark:border-white/10 p-8">
          <h1 className="text-3xl font-black mb-2">{t('cms.notFoundTitle')}</h1>
          <p className="text-surface-500 mb-4">{t('cms.notFoundDesc')}</p>
          <Link to="/" className="px-4 py-2 rounded-lg bg-accent-500 text-white inline-flex">
            {t('cms.backHome')}
          </Link>
        </div>
      </div>
    </CmsPublicLayout>
  )
}

