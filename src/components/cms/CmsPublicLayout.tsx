import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { useTranslation } from '@/stores/i18nStore'
import { fetchCmsNavigation } from '@/services/cms'
import type { CmsNavigationResponse } from '@/types/cms'

interface CmsPublicLayoutProps {
  children: ReactNode
}

export function CmsPublicLayout({ children }: CmsPublicLayoutProps) {
  const { language, setLanguage, supportedLanguages, languageNames, languageFlags, t } = useTranslation()
  const [navigation, setNavigation] = useState<CmsNavigationResponse>({
    staticPages: [],
    docsPages: []
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadNavigation = async () => {
      try {
        const nav = await fetchCmsNavigation(language)
        if (mounted) {
          setNavigation(nav)
        }
      } catch {
        if (mounted) {
          setNavigation({ staticPages: [], docsPages: [] })
        }
      }
    }
    loadNavigation()
    return () => {
      mounted = false
    }
  }, [language])

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100">
      <header className="sticky top-0 z-20 backdrop-blur-lg bg-white/85 dark:bg-surface-950/80 border-b border-surface-200/50 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 font-black text-lg tracking-tight min-w-0">
            <img
              src="/adbzero_logo.webp"
              alt={t('common.appName')}
              className="w-8 h-8 rounded-lg object-cover border border-surface-200/70 dark:border-white/10 shadow-sm"
            />
            <span className="truncate">{t('common.appName')}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-4 text-sm font-medium">
              <Link to="/" className="hover:text-accent-500 transition-colors">{t('cms.home')}</Link>
              <Link to="/blog" className="hover:text-accent-500 transition-colors">{t('cms.blog')}</Link>
              {navigation.staticPages.length ? (
                <div className="relative group">
                  <button type="button" className="hover:text-accent-500 transition-colors">
                    {t('cms.pages')}
                  </button>
                  <div className="hidden group-hover:block absolute right-0 top-full pt-2">
                    <div className="min-w-[14rem] rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900 shadow-lg p-1.5">
                      {navigation.staticPages.map((page) => (
                        <Link
                          key={page.id}
                          to={`/${page.slug}`}
                          className="block px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/10"
                        >
                          {page.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {navigation.docsPages.length ? (
                <div className="relative group">
                  <button type="button" className="hover:text-accent-500 transition-colors">
                    {t('cms.documentation')}
                  </button>
                  <div className="hidden group-hover:block absolute right-0 top-full pt-2">
                    <div className="min-w-[14rem] rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900 shadow-lg p-1.5">
                      {navigation.docsPages.map((page) => (
                        <Link
                          key={page.id}
                          to={`/${page.slug}`}
                          className="block px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/10"
                        >
                          {page.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </nav>

            {/* Mobile hamburger button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden w-10 h-10 rounded-xl bg-surface-100/70 dark:bg-surface-900/70 border border-surface-200 dark:border-white/10 flex items-center justify-center"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-100/70 dark:bg-surface-900/70 border border-surface-200 dark:border-white/10">
              <Globe className="w-4 h-4 text-surface-500" />
              <select
                value={language}
                onChange={(event) => void setLanguage(event.target.value as any)}
                aria-label={t('settings.language')}
                className="bg-transparent text-sm font-medium text-surface-700 dark:text-surface-200 outline-none cursor-pointer pr-2"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang} value={lang} className="bg-surface-100 dark:bg-surface-900">
                    {languageFlags[lang]} {languageNames[lang]}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:hidden relative w-10 h-10 rounded-xl bg-surface-100/70 dark:bg-surface-900/70 border border-surface-200 dark:border-white/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-surface-600 dark:text-surface-300 pointer-events-none" />
              <select
                value={language}
                onChange={(event) => void setLanguage(event.target.value as any)}
                aria-label={t('settings.language')}
                title={t('settings.language')}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {languageFlags[lang]} {languageNames[lang]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-surface-200/50 dark:border-white/10 bg-white/95 dark:bg-surface-950/95 backdrop-blur-lg">
            <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1 text-sm font-medium">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-lg hover:bg-surface-100 dark:hover:bg-white/10 transition-colors">{t('cms.home')}</Link>
              <Link to="/blog" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 rounded-lg hover:bg-surface-100 dark:hover:bg-white/10 transition-colors">{t('cms.blog')}</Link>
              {navigation.staticPages.map((page) => (
                <Link
                  key={page.id}
                  to={`/${page.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg hover:bg-surface-100 dark:hover:bg-white/10 transition-colors"
                >
                  {page.title}
                </Link>
              ))}
              {navigation.docsPages.map((page) => (
                <Link
                  key={page.id}
                  to={`/${page.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg hover:bg-surface-100 dark:hover:bg-white/10 transition-colors"
                >
                  📄 {page.title}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-surface-200/60 dark:border-white/10 mt-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-surface-500">
          {t('cms.footer')}
        </div>
      </footer>
    </div>
  )
}
