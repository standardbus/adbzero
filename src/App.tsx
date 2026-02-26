import { useEffect, lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Layout } from '@/components/layout/Layout'
import { ConnectPage } from '@/pages/ConnectPage'
import { Toast } from '@/components/ui/Toast'
import { AuthModal } from '@/components/auth/AuthModal'
import { AdbTerminal } from '@/components/terminal/AdbTerminal'
import { SyncUpdateModal } from '@/components/sync/SyncUpdateModal'
import { MobileSyncModal } from '@/components/sync/MobileSyncModal'
import { useAppStore } from '@/stores/appStore'
import { useAdbStore } from '@/stores/adbStore'
import { useAuthStore } from '@/stores/authStore'
import { useUadSync } from '@/hooks/useUadSync'
import { useAdbInterceptor } from '@/hooks/useAdbInterceptor'
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker'

// Lazy-loaded pages (code-split per route)
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const DebloaterPage = lazy(() => import('@/pages/DebloaterPage').then(m => ({ default: m.DebloaterPage })))
const DegooglePage = lazy(() => import('@/pages/DegooglePage').then(m => ({ default: m.DegooglePage })))
const PrivacyToolsPage = lazy(() => import('@/pages/PrivacyToolsPage').then(m => ({ default: m.PrivacyToolsPage })))
const RootToolsPage = lazy(() => import('@/pages/RootToolsPage').then(m => ({ default: m.RootToolsPage })))
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then(m => ({ default: m.HistoryPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const SetupPage = lazy(() => import('@/pages/SetupPage').then(m => ({ default: m.SetupPage })))
const DeviceToolsPage = lazy(() => import('@/pages/DeviceToolsPage').then(m => ({ default: m.DeviceToolsPage })))
const ScreenMirrorPage = lazy(() => import('@/pages/ScreenMirrorPage').then(m => ({ default: m.ScreenMirrorPage })))
const DesktopPage = lazy(() => import('@/pages/DesktopPage').then(m => ({ default: m.DesktopPage })))
const ShizukuPage = lazy(() => import('@/pages/ShizukuPage').then(m => ({ default: m.ShizukuPage })))
const AdminAnalyticsPage = lazy(() => import('@/pages/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })))
const ApkInstallerPage = lazy(() => import('@/pages/ApkInstallerPage').then(m => ({ default: m.ApkInstallerPage })))
const CommunityListsPage = lazy(() => import('@/pages/CommunityListsPage').then(m => ({ default: m.CommunityListsPage })))
const AppClonerPage = lazy(() => import('@/pages/AppClonerPage').then(m => ({ default: m.AppClonerPage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function App() {
  const currentPage = useAppStore((state) => state.currentPage)
  const isConnected = useAdbStore((state) => state.isConnected)

  // Sincronizza automaticamente il database UAD all'avvio e ogni 24h
  useUadSync()

  // Intercetta tutti i comandi ADB per il logging nel terminale (una sola volta globalmente)
  useAdbInterceptor()

  // Initialize auth on mount
  useEffect(() => {
    useAuthStore.getState().initialize()
  }, [])

  // Redirect to connect page if not connected (except for setup page)
  useEffect(() => {
    const allowedWithoutConnection = ['connect', 'setup']
    if (!isConnected && !allowedWithoutConnection.includes(currentPage)) {
      useAppStore.getState().setCurrentPage('connect')
    }
  }, [isConnected, currentPage])

  const renderPage = () => {
    switch (currentPage) {
      case 'connect':
        return <ConnectPage key="connect" />
      case 'dashboard':
        return <DashboardPage key="dashboard" />
      case 'device-tools':
        return <DeviceToolsPage key="device-tools" />
      case 'debloater':
        return <DebloaterPage key="debloater" />
      case 'degoogle':
        return <DegooglePage key="degoogle" />
      case 'privacy':
        return <PrivacyToolsPage key="privacy" />
      case 'root-tools':
        return <RootToolsPage key="root-tools" />
      case 'history':
        return <HistoryPage key="history" />
      case 'settings':
        return <SettingsPage key="settings" />
      case 'setup':
        return <SetupPage key="setup" />
      case 'screen-mirror':
        return <ScreenMirrorPage key="screen-mirror" />
      case 'desktop':
        return <DesktopPage key="desktop" />
      case 'shizuku':
        return <ShizukuPage key="shizuku" />
      case 'admin-analytics':
        // Ulteriore controllo di sicurezza lato client
        const authState = useAuthStore.getState()
        if (!authState.isAdmin) {
          useAppStore.getState().setCurrentPage('connect')
          return <ConnectPage key="connect" />
        }
        return <AdminAnalyticsPage key="admin-analytics" />
      case 'apk-installer':
        return <ApkInstallerPage key="apk-installer" />
      case 'debloat-lists':
        return <CommunityListsPage key="debloat-lists" />
      case 'app-cloner':
        return <AppClonerPage key="app-cloner" />
      default:
        return <ConnectPage key="connect" />
    }
  }

  // Show sidebar when connected OR on setup page
  const showSidebar = isConnected || currentPage === 'setup'

  // No-scroll pages (Screen Mirror, Desktop)
  const noScroll = currentPage === 'screen-mirror' || currentPage === 'desktop'

  return (
    <Layout showSidebar={showSidebar} noScroll={noScroll}>
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait">
          {renderPage()}
        </AnimatePresence>
      </Suspense>
      <AnalyticsTracker />
      <Toast />
      <AuthModal />
      <SyncUpdateModal />
      <MobileSyncModal />
      <AdbTerminal sidebarOffset={showSidebar ? '16rem' : '0px'} />
    </Layout>
  )
}

export default App
