/**
 * Settings Page
 * App settings and theme management
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Sun,
  Moon,
  Shield,
  Trash2,
  Info,
  ExternalLink,
  RefreshCw,
  Database,
  Terminal,
  Copy,
  Check,
  Globe,
  ChevronDown,
  ShieldAlert,
  Smartphone,
  UserCheck
} from 'lucide-react'
import { useAppStore, type Theme } from '@/stores/appStore'
import { useAdbStore } from '@/stores/adbStore'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from '@/stores/i18nStore'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { syncUadToSupabase } from '@/services/package-database'
import { getUserDevices, disassociateDevice, type DeviceUserAssociation } from '@/services/device-auth'
import { isAdmin, getAppSettings, saveAppSettings, type AppSettings } from '@/config/app'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function SettingsPage() {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const showToast = useAppStore((state) => state.showToast)
  const clearLogs = useAdbStore((state) => state.clearLogs)
  const commandLogs = useAdbStore((state) => state.commandLogs)
  const { user, isAuthenticated } = useAuthStore()
  const { t, language, setLanguage, supportedLanguages, languageNames, languageFlags } = useTranslation()

  // Check if user is admin
  const userIsAdmin = isAdmin(user?.id)

  const [isSyncingToSupabase, setIsSyncingToSupabase] = useState(false)
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [showLangDropdown, setShowLangDropdown] = useState(false)

  // App settings (auto-login)
  const [appSettings, setAppSettings] = useState<AppSettings>(getAppSettings())
  const [userDevices, setUserDevices] = useState<DeviceUserAssociation[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)

  // Load user devices
  useEffect(() => {
    if (isAuthenticated && user) {
      setLoadingDevices(true)
      getUserDevices(user.id)
        .then(setUserDevices)
        .finally(() => setLoadingDevices(false))
    }
  }, [isAuthenticated, user])

  const handleToggleAutoLogin = (enabled: boolean) => {
    const newSettings = { ...appSettings, deviceAutoLogin: enabled }
    setAppSettings(newSettings)
    saveAppSettings(newSettings)
    showToast({
      type: 'success',
      title: enabled ? t('settings.autoLoginEnabled') : t('settings.autoLoginDisabled'),
      message: enabled
        ? t('settings.autoLoginEnabledMsg')
        : t('settings.autoLoginDisabledMsg')
    })
  }

  const handleToggleDeviceScraping = (enabled: boolean) => {
    const newSettings = { ...appSettings, enableDeviceScraping: enabled }
    setAppSettings(newSettings)
    saveAppSettings(newSettings)
    showToast({
      type: 'success',
      title: enabled ? t('settings.deviceScrapingEnabled') : t('settings.deviceScrapingDisabled'),
      message: enabled
        ? t('settings.deviceScrapingSubtitle')
        : t('settings.deviceScrapingDisabled')
    })
  }

  const handleRemoveDevice = async (deviceId: string) => {
    const success = await disassociateDevice(deviceId)
    if (success) {
      setUserDevices(prev => prev.filter(d => d.id !== deviceId))
      showToast({
        type: 'success',
        title: t('settings.deviceRemoved'),
        message: t('settings.deviceRemovedMsg')
      })
    } else {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: t('settings.cannotRemoveDevice')
      })
    }
  }

  const themes: { value: Theme; labelKey: string; icon: typeof Sun }[] = [
    { value: 'light', labelKey: 'settings.themeLight', icon: Sun },
    { value: 'dark', labelKey: 'settings.themeDark', icon: Moon },
  ]

  const handleSyncToSupabase = async () => {
    setIsSyncingToSupabase(true)
    try {
      const result = await syncUadToSupabase()
      if (result.error) {
        throw new Error(result.error)
      }
      showToast({
        type: 'success',
        title: t('settings.syncCompleted'),
        message: t('settings.packagesSynced', { count: result.added }) + ` (${result.skipped} già esistenti)`
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: t('settings.syncError'),
        message: error instanceof Error ? error.message : t('toast.unknownError')
      })
    } finally {
      setIsSyncingToSupabase(false)
    }
  }

  const copyLogToClipboard = (log: typeof commandLogs[0]) => {
    const text = `[${new Date(log.timestamp).toLocaleString(language)}] ${log.command}\n${log.result}: ${log.message || t('common.ok')}`
    navigator.clipboard.writeText(text)
    setCopiedLogId(log.id)
    setTimeout(() => setCopiedLogId(null), 2000)
  }

  const exportAllLogs = () => {
    const text = commandLogs.map(log =>
      `[${new Date(log.timestamp).toLocaleString(language)}] ${log.command}\n→ ${log.result}: ${log.message || t('common.ok')}\n`
    ).join('\n')

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `adbzero-logs-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)

    showToast({
      type: 'success',
      title: t('settings.logsExported'),
      message: t('settings.commandsSaved', { count: commandLogs.length })
    })
  }

  // Show only first 20 or all
  const visibleLogs = showAllLogs ? commandLogs : commandLogs.slice(0, 20)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto terminal-spacer">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
          {t('settings.title')}
        </h1>
        <p className="text-surface-500 mt-1">
          {t('settings.subtitle')}
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Theme */}
        <motion.div variants={item}>
          <Card variant="default" padding="lg">
            <CardHeader
              title={t('settings.appearance')}
              subtitle={t('settings.appearanceSubtitle')}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themes.map((themeItem) => {
                const Icon = themeItem.icon
                const isActive = theme === themeItem.value

                return (
                  <motion.button
                    key={themeItem.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTheme(themeItem.value)}
                    className={`
                      flex flex-col items-center gap-3 p-4 rounded-xl
                      border transition-all duration-200
                      ${isActive
                        ? 'bg-accent-500/10 border-accent-500/30 text-accent-600 dark:text-accent-400'
                        : 'bg-surface-50 dark:bg-white/5 border-surface-200 dark:border-white/10 text-surface-600 dark:text-surface-400 hover:border-accent-500/30'
                      }
                    `}
                  >
                    <Icon className="w-6 h-6" strokeWidth={1.5} />
                    <span className="text-sm font-medium">{t(themeItem.labelKey)}</span>
                  </motion.button>
                )
              })}
            </div>
          </Card>
        </motion.div>

        {/* Language */}
        <motion.div variants={item}>
          <Card variant="default" padding="lg">
            <CardHeader
              title={t('settings.language')}
              subtitle={t('settings.languageSubtitle')}
            />
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Globe className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-surface-500 mb-3">
                  {t('settings.languageDetected')}
                </p>

                {/* Language Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowLangDropdown(!showLangDropdown)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-surface-200 dark:border-white/10 bg-surface-50 dark:bg-white/5 hover:border-accent-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{languageFlags[language]}</span>
                      <span className="font-medium text-surface-900 dark:text-white">
                        {languageNames[language]}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                  </button>

                  {showLangDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full left-0 right-0 mt-2 py-2 rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-800 shadow-lg z-10"
                    >
                      {supportedLanguages.map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            setLanguage(lang)
                            setShowLangDropdown(false)
                            showToast({
                              type: 'success',
                              title: t('settings.languageChanged'),
                              message: languageNames[lang]
                            })
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-100 dark:hover:bg-white/5 transition-colors ${lang === language ? 'bg-accent-500/10' : ''
                            }`}
                        >
                          <span className="text-xl">{languageFlags[lang]}</span>
                          <span className={`font-medium ${lang === language ? 'text-accent-600 dark:text-accent-400' : 'text-surface-700 dark:text-surface-300'}`}>
                            {languageNames[lang]}
                          </span>
                          {lang === language && (
                            <Check className="w-4 h-4 text-accent-500 ml-auto" strokeWidth={2} />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Auto-Login Device - Admin Only */}
        {userIsAdmin && (
          <motion.div variants={item}>
            <Card variant="default" padding="lg">
              <CardHeader
                title={t('settings.autoLogin')}
                subtitle={t('settings.autoLoginSubtitle')}
              />
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10">
                  <UserCheck className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-surface-900 dark:text-white">
                        {t('settings.autoLogin')}
                      </p>
                      <p className="text-sm text-surface-500">
                        {t('settings.autoLoginDescription')}
                      </p>
                    </div>
                    <Switch
                      checked={appSettings.deviceAutoLogin}
                      onChange={handleToggleAutoLogin}
                    />
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t('settings.adminSettingWarning')}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Device Scraping - Admin Only */}
        {userIsAdmin && (
          <motion.div variants={item}>
            <Card variant="default" padding="lg">
              <CardHeader
                title={t('settings.deviceScraping')}
                subtitle={t('settings.deviceScrapingSubtitle')}
              />
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-indigo-500/10">
                  <RefreshCw className="w-5 h-5 text-indigo-500" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-surface-900 dark:text-white">
                        {t('settings.deviceScraping')}
                      </p>
                      <p className="text-sm text-surface-500">
                        {t('settings.deviceScrapingDescription')}
                      </p>
                    </div>
                    <Switch
                      checked={appSettings.enableDeviceScraping}
                      onChange={handleToggleDeviceScraping}
                    />
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
                      {t('settings.adminScrapingWarning')}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Associated Devices - Authenticated Users */}
        {isAuthenticated && userDevices.length > 0 && (
          <motion.div variants={item}>
            <Card variant="default" padding="lg">
              <CardHeader
                title={t('settings.associatedDevices')}
                subtitle={`${userDevices.length} ${t('settings.devicesLinked')}`}
              />
              <div className="space-y-3">
                {userDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/10"
                  >
                    <div className="p-2.5 rounded-xl bg-accent-500/10">
                      <Smartphone className="w-5 h-5 text-accent-500" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-surface-900 dark:text-white truncate">
                        {device.device_manufacturer} {device.device_model}
                      </p>
                      <p className="text-xs text-surface-500 truncate">
                        {t('settings.lastAccess')}: {new Date(device.last_connected_at).toLocaleDateString(language)}
                      </p>
                      {device.is_primary && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs bg-accent-500/10 text-accent-600 dark:text-accent-400">
                          <Check className="w-3 h-3" strokeWidth={2} />
                          {t('settings.primary')}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDevice(device.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </Button>
                  </div>
                ))}
              </div>
              {loadingDevices && (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-surface-400" strokeWidth={1.5} />
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* UAD Database */}
        <motion.div variants={item}>
          <Card variant="default" padding="lg">
            <CardHeader
              title={t('settings.uadDatabase')}
              subtitle={t('settings.uadDatabaseSubtitle')}
            />
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-violet-500/10">
                <Database className="w-5 h-5 text-violet-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-surface-500 mb-2">
                  {t('settings.uadDatabaseDesc')}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <a
                    href="https://github.com/Universal-Debloater-Alliance/universal-android-debloater-next-generation"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent-500 hover:text-accent-400 inline-flex items-center gap-1"
                  >
                    {t('settings.goToUadRepo')}
                    <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                  </a>

                  {/* Sync to Supabase - Admin Only */}
                  {userIsAdmin && (
                    <>
                      <span className="text-surface-300 dark:text-surface-600">|</span>
                      <button
                        onClick={handleSyncToSupabase}
                        disabled={isSyncingToSupabase}
                        className="text-xs text-violet-500 hover:text-violet-400 inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {isSyncingToSupabase ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                            {t('settings.syncing')}
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3 h-3" strokeWidth={1.5} />
                            {t('settings.forceSyncUad')}
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Logs */}
        <motion.div variants={item}>
          <Card variant="default" padding="lg">
            <CardHeader
              title={t('settings.commandLogs')}
              subtitle={`${commandLogs.length} ${t('settings.commandsRecorded')}`}
              action={
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Terminal className="w-4 h-4" strokeWidth={1.5} />}
                    onClick={exportAllLogs}
                    disabled={commandLogs.length === 0}
                  >
                    {t('common.export')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" strokeWidth={1.5} />}
                    onClick={clearLogs}
                    disabled={commandLogs.length === 0}
                  >
                    {t('common.clear')}
                  </Button>
                </div>
              }
            />

            {commandLogs.length === 0 ? (
              <div className="text-center py-8">
                <Terminal className="w-8 h-8 mx-auto text-surface-400 mb-3" strokeWidth={1.5} />
                <p className="text-sm text-surface-500">
                  {t('settings.noCommandsExecuted')}
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  {t('settings.commandsWillBeRecorded')}
                </p>
              </div>
            ) : (
              <>
                <div className="max-h-96 overflow-y-auto space-y-2 font-mono text-xs">
                  {visibleLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-surface-50 dark:bg-white/5 hover:bg-surface-100 dark:hover:bg-white/10 transition-colors group"
                    >
                      <div className={`
                        w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                        ${log.result === 'success' ? 'bg-emerald-500' : 'bg-red-500'}
                      `} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-surface-900 dark:text-white break-all">
                            $ {log.command}
                          </code>
                        </div>
                        {log.message && (
                          <pre className={`text-[11px] mt-1 whitespace-pre-wrap break-all ${log.result === 'success' ? 'text-surface-500' : 'text-red-400'}`}>
                            {log.message}
                          </pre>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] text-surface-400">
                          {new Date(log.timestamp).toLocaleTimeString(language)}
                        </span>
                        <button
                          onClick={() => copyLogToClipboard(log)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-200 dark:hover:bg-white/10"
                          title={t('common.copy')}
                        >
                          {copiedLogId === log.id ? (
                            <Check className="w-3 h-3 text-emerald-500" strokeWidth={2} />
                          ) : (
                            <Copy className="w-3 h-3 text-surface-400" strokeWidth={1.5} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {commandLogs.length > 20 && (
                  <div className="mt-4 pt-4 border-t border-surface-200 dark:border-white/10 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllLogs(!showAllLogs)}
                    >
                      {showAllLogs
                        ? t('common.showLess')
                        : `${t('common.showMore')} (${commandLogs.length})`
                      }
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </motion.div>

        {/* Privacy */}
        <motion.div variants={item}>
          <Card variant="default" padding="lg">
            <CardHeader
              title={t('settings.privacy')}
              subtitle={t('settings.privacySubtitle')}
            />
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-emerald-500/10">
                  <Shield className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-medium text-surface-900 dark:text-white mb-1">
                    {t('settings.clientSide')}
                  </p>
                  <p className="text-sm text-surface-500">
                    {t('settings.clientSideDesc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-accent-500/10">
                  <Info className="w-5 h-5 text-accent-500" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-medium text-surface-900 dark:text-white mb-1">
                    {t('settings.packageDatabase')}
                  </p>
                  <p className="text-sm text-surface-500">
                    {t('settings.packageDatabaseDesc')}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* About */}
        <motion.div variants={item}>
          <Card variant="default" padding="lg">
            <CardHeader
              title={t('settings.about')}
              subtitle={`ADBZero ${t('settings.version')}`}
            />
            <div className="space-y-3">
              <p className="text-sm text-surface-500">
                {t('settings.aboutDesc')}
              </p>
              <div className="flex flex-wrap gap-3">

              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
