/**
 * Navigation Sidebar
 * Apple-like design with glassmorphism
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Package,
  Settings,
  Unplug,
  ChevronRight,
  Sparkles,
  Shield,
  History,
  Leaf,
  Wrench,
  User,
  LogIn,
  LogOut,
  ChevronDown,
  Monitor,
  MonitorPlay,
  HelpCircle,
  ScreenShare,
  Lightbulb,
  Users,
  Zap,
  BarChart3,
  Download,
  Copy
} from 'lucide-react'
import { useAppStore, type Page } from '@/stores/appStore'
import { useAdbStore } from '@/stores/adbStore'
import { useAuthStore } from '@/stores/authStore'
import { useAdb } from '@/hooks/useAdb'
import { useTranslation } from '@/stores/i18nStore'
import { SuggestImprovementModal } from './SuggestImprovementModal'

interface NavItem {
  id: Page
  labelKey: string
  icon: typeof LayoutDashboard
  premium?: boolean
  requiresAuth?: boolean
}

const navItems: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'screen-mirror', labelKey: 'nav.screenMirror', icon: ScreenShare },
  { id: 'desktop', labelKey: 'nav.desktopMode', icon: MonitorPlay },
  { id: 'device-tools', labelKey: 'nav.deviceTools', icon: Monitor },
  { id: 'debloater', labelKey: 'nav.debloater', icon: Package },
  { id: 'debloat-lists', labelKey: 'nav.debloatLists', icon: Users },
  { id: 'degoogle', labelKey: 'nav.degoogle', icon: Leaf },
  { id: 'privacy', labelKey: 'nav.privacy', icon: Shield },
  { id: 'root-tools', labelKey: 'nav.rootTools', icon: Wrench },
  { id: 'shizuku', labelKey: 'nav.shizuku', icon: Zap },
  { id: 'apk-installer', labelKey: 'nav.apkInstaller', icon: Download },
  { id: 'app-cloner', labelKey: 'nav.appCloner', icon: Copy },
  { id: 'admin-analytics', labelKey: 'nav.analytics', icon: BarChart3, requiresAuth: true },
  { id: 'history', labelKey: 'nav.history', icon: History, requiresAuth: true },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings },
]

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const currentPage = useAppStore((state) => state.currentPage)
  const setCurrentPage = useAppStore((state) => state.setCurrentPage)
  const isPremium = useAppStore((state) => state.isPremium)
  const deviceInfo = useAdbStore((state) => state.deviceInfo)
  const { disconnect } = useAdb()
  const { t } = useTranslation()

  const { user, isAuthenticated, isAdmin, logout, setShowAuthModal } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)

  const handleNavClick = (item: NavItem) => {
    if (item.requiresAuth && !isAuthenticated) {
      setShowAuthModal(true, 'login')
      return
    }
    if (item.premium && !isPremium) {
      return
    }
    setCurrentPage(item.id)
    onNavigate?.()
  }

  return (
    <>
      <nav className="h-full flex flex-col bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-r border-surface-200/50 dark:border-white/5">
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-surface-200/70 dark:border-white/10 shadow-lg shadow-accent-500/20">
              <img src="/adbzero_logo.webp" alt={t('common.appName')} className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="font-semibold text-surface-900 dark:text-white tracking-tight">
                {t('common.appName')}
              </h1>
              <p className="text-xs text-surface-500">{t('common.tagline')}</p>
            </div>
          </div>
        </div>

        {/* User Account Section */}
        <div className="mx-4 mb-4">
          {isAuthenticated && user ? (
            <div className="relative">
              <motion.button
                onClick={() => setShowUserMenu(!showUserMenu)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full glass-card p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-accent-500/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-accent-500" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                    {user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-surface-500 truncate">
                    {user.email}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-surface-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                  strokeWidth={1.5}
                />
              </motion.button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 py-2 glass-card z-10"
                  >
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        setCurrentPage('history')
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/5 flex items-center gap-2"
                    >
                      <History className="w-4 h-4" strokeWidth={1.5} />
                      {t('nav.myDevices')}
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        logout()
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" strokeWidth={1.5} />
                      {t('nav.logout')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <motion.button
              onClick={() => setShowAuthModal(true, 'login')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full glass-card p-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-accent-500/10 flex items-center justify-center">
                <LogIn className="w-4 h-4 text-accent-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-surface-900 dark:text-white">
                  {t('nav.login')}
                </p>
                <p className="text-xs text-surface-500">
                  {t('sidebar.syncDevices')}
                </p>
              </div>
            </motion.button>
          )}
        </div>

        {/* Device Info Card */}
        {deviceInfo && (
          <div className="mx-4 mb-6">
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                    {deviceInfo.model}
                  </p>
                  <p className="text-xs text-surface-500 truncate">
                    {deviceInfo.manufacturer}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-surface-500">Android {deviceInfo.androidVersion}</span>
                <span className="flex items-center gap-1 text-surface-600 dark:text-surface-400">
                  <BatteryIcon level={deviceInfo.batteryLevel} />
                  {deviceInfo.batteryLevel}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 px-3 overflow-y-auto">
          <div className="space-y-1">
            {navItems.filter((item) => {
              if (item.id === 'desktop') {
                const apiLevel = deviceInfo?.apiLevel ? parseInt(deviceInfo.apiLevel) : 0
                return apiLevel >= 33
              }
              if (item.id === 'admin-analytics') {
                return isAdmin
              }
              return true
            }).map((item) => {
              const Icon = item.icon
              const isActive = currentPage === item.id
              const isLocked = item.premium && !isPremium
              const needsAuth = item.requiresAuth && !isAuthenticated
              const isAppCloner = item.id === 'app-cloner'

              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
                  transition-all duration-200 group
                  ${isActive
                      ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/5 hover:text-surface-900 dark:hover:text-white'
                    }
                  ${isLocked || needsAuth ? 'opacity-60' : ''}
                `}
                >
                  <Icon
                    className={`w-5 h-5 ${isActive ? 'text-accent-500' : ''}`}
                    strokeWidth={1.5}
                  />
                  <span className="flex-1 font-medium text-sm">{t(item.labelKey)}</span>
                  {item.premium && (
                    <Sparkles className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                  )}
                  {isAppCloner && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent-500 text-white font-bold leading-none">NEW</span>
                  )}
                  {item.requiresAuth && !isAuthenticated && (
                    <LogIn className="w-4 h-4 text-surface-400" strokeWidth={1.5} />
                  )}
                  {isActive && (
                    <ChevronRight className="w-4 h-4 opacity-50" strokeWidth={1.5} />
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-200/50 dark:border-white/5 space-y-2">
          {isAdmin && (
            <a
              href="/app/admin/cms"
              className="w-full mb-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent-500/10 text-accent-600 dark:text-accent-400 font-semibold text-sm hover:bg-accent-500/20 transition-colors"
            >
              <BarChart3 className="w-4 h-4" strokeWidth={1.5} />
              {t('cms.adminTitle')}
            </a>
          )}
          {/* Setup button and Suggest Improvement button row */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setCurrentPage('setup')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              transition-all duration-200 font-medium text-sm
              ${currentPage === 'setup'
                  ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                  : 'bg-surface-100 dark:bg-white/5 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-white/10'
                }`}
            >
              <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
              {t('nav.setup')}
            </motion.button>

            {/* Suggest Improvement button - only visible when authenticated */}
            {isAuthenticated && (
              <motion.button
                onClick={() => setShowSuggestionModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={t('sidebar.suggestImprovement')}
                className="w-11 h-11 flex items-center justify-center rounded-xl
                bg-amber-500/10 text-amber-600 dark:text-amber-400 
                hover:bg-amber-500/20 transition-all duration-200"
              >
                <Lightbulb className="w-5 h-5" strokeWidth={1.5} />
              </motion.button>
            )}
          </div>

          {deviceInfo && (
            <motion.button
              onClick={disconnect}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20
              transition-all duration-200 font-medium text-sm"
            >
              <Unplug className="w-4 h-4" strokeWidth={1.5} />
              {t('nav.disconnect')}
            </motion.button>
          )}
        </div>
      </nav>

      <SuggestImprovementModal
        isOpen={showSuggestionModal}
        onClose={() => setShowSuggestionModal(false)}
      />
    </>
  )
}

function BatteryIcon({ level }: { level: number }) {
  const getColor = () => {
    if (level <= 20) return 'text-red-500'
    if (level <= 50) return 'text-amber-500'
    return 'text-emerald-500'
  }

  return (
    <svg
      className={`w-4 h-4 ${getColor()}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <rect x="2" y="7" width="18" height="10" rx="2" />
      <rect x="4" y="9" width={Math.max(1, (14 * level) / 100)} height="6" rx="1" fill="currentColor" />
      <path d="M22 11v2" strokeLinecap="round" />
    </svg>
  )
}
