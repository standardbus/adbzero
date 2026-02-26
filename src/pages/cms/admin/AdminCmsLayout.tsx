import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from '@/stores/i18nStore'
import { Toast } from '@/components/ui/Toast'

function CmsNavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
        isActive
          ? 'bg-accent-500 text-white'
          : 'bg-surface-100 dark:bg-white/10 text-surface-700 dark:text-surface-100'
      }`}
    >
      {label}
    </NavLink>
  )
}

export function AdminCmsLayout() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100">
      <header className="border-b border-surface-200/60 dark:border-white/10 bg-white/85 dark:bg-surface-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-2 justify-between">
          <div>
            <h1 className="font-black text-xl tracking-tight">{t('cms.adminTitle')}</h1>
            <p className="text-xs text-surface-500">{t('cms.adminSubtitle')}</p>
          </div>
          <a href="/app" className="px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-white/10 text-sm font-semibold">
            {t('cms.backToApp')}
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <CmsNavItem to="/app/admin/cms" label={t('cms.contents')} />
          <CmsNavItem to="/app/admin/cms/editor/new" label={t('cms.newContent')} />
          <CmsNavItem to="/app/admin/cms/media" label={t('cms.mediaLibrary')} />
          <CmsNavItem to="/app/admin/cms/revisions" label={t('cms.revisions')} />
        </div>
        <Outlet />
      </div>
      <Toast />
    </div>
  )
}
