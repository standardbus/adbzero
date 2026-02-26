import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { useTranslation } from '@/stores/i18nStore'

const ToolApp = lazy(() => import('@/App'))
const AppAccessGuard = lazy(() => import('@/components/routing/AppAccessGuard').then((m) => ({ default: m.AppAccessGuard })))
const AdminGuard = lazy(() => import('@/components/cms/admin/AdminGuard').then((m) => ({ default: m.AdminGuard })))
const AdminCmsLayout = lazy(() => import('@/pages/cms/admin/AdminCmsLayout').then((m) => ({ default: m.AdminCmsLayout })))
const AdminCmsDashboardPage = lazy(() => import('@/pages/cms/admin/AdminCmsDashboardPage').then((m) => ({ default: m.AdminCmsDashboardPage })))
const AdminCmsEditorPage = lazy(() => import('@/pages/cms/admin/AdminCmsEditorPage').then((m) => ({ default: m.AdminCmsEditorPage })))
const AdminCmsMediaPage = lazy(() => import('@/pages/cms/admin/AdminCmsMediaPage').then((m) => ({ default: m.AdminCmsMediaPage })))
const AdminCmsRevisionsPage = lazy(() => import('@/pages/cms/admin/AdminCmsRevisionsPage').then((m) => ({ default: m.AdminCmsRevisionsPage })))
const HomePage = lazy(() => import('@/pages/cms/HomePage').then((m) => ({ default: m.HomePage })))
const BlogIndexPage = lazy(() => import('@/pages/cms/BlogIndexPage').then((m) => ({ default: m.BlogIndexPage })))
const BlogDetailPage = lazy(() => import('@/pages/cms/BlogDetailPage').then((m) => ({ default: m.BlogDetailPage })))
const CmsPage = lazy(() => import('@/pages/cms/CmsPage').then((m) => ({ default: m.CmsPage })))
const NotFoundPage = lazy(() => import('@/pages/cms/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

function RouterLoader() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center text-surface-500">
      {t('common.loading')}
    </div>
  )
}

export function AppRouter() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Suspense fallback={<RouterLoader />}>
          <Routes>
            <Route
              path="/app/admin/cms/*"
              element={(
                <AdminGuard>
                  <AdminCmsLayout />
                </AdminGuard>
              )}
            >
              <Route index element={<AdminCmsDashboardPage />} />
              <Route path="editor/new" element={<AdminCmsEditorPage />} />
              <Route path="editor/:contentId" element={<AdminCmsEditorPage />} />
              <Route path="media" element={<AdminCmsMediaPage />} />
              <Route path="revisions" element={<AdminCmsRevisionsPage />} />
              <Route path="*" element={<Navigate to="/app/admin/cms" replace />} />
            </Route>

            <Route
              path="/app/*"
              element={(
                <AppAccessGuard>
                  <ToolApp />
                </AppAccessGuard>
              )}
            />
            <Route path="/" element={<HomePage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />
            <Route path="/:slug" element={<CmsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  )
}
