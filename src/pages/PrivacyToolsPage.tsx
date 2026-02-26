/**
 * Privacy Tools Page
 * Strumenti per migliorare la privacy senza root
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Wifi,
  Eye,
  EyeOff,
  Lock,
  Globe,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Modal, ModalActions } from '@/components/ui/Modal'
import { shell } from '@/services/adb-client'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/stores/i18nStore'
import { PRIVATE_DNS_SERVERS } from '@/data/hosts-lists'
import { validateDnsHostname } from '@/services/command-sanitizer'

interface PrivacySetting {
  id: string
  icon: typeof Shield
  category: 'network' | 'permissions' | 'telemetry' | 'security'
  checkCommand: string
  enableCommand: string
  disableCommand: string
  enabledValue: string
  warning?: string
}

const PRIVACY_SETTINGS: PrivacySetting[] = [
  {
    id: 'adb_over_network',
    icon: Wifi,
    category: 'security',
    checkCommand: 'settings get global adb_wifi_enabled',
    enableCommand: 'settings put global adb_wifi_enabled 1',
    disableCommand: 'settings put global adb_wifi_enabled 0',
    enabledValue: '1'
  },
  {
    id: 'install_unknown',
    icon: Lock,
    category: 'security',
    checkCommand: 'settings get secure install_non_market_apps',
    enableCommand: 'settings put secure install_non_market_apps 1',
    disableCommand: 'settings put secure install_non_market_apps 0',
    enabledValue: '1'
  },
  {
    id: 'usage_stats',
    icon: Eye,
    category: 'telemetry',
    checkCommand: 'settings get secure usage_stats_enabled',
    enableCommand: 'settings put secure usage_stats_enabled 1',
    disableCommand: 'settings put secure usage_stats_enabled 0',
    enabledValue: '1'
  },
  {
    id: 'crash_reports',
    icon: AlertTriangle,
    category: 'telemetry',
    checkCommand: 'settings get global send_action_app_error',
    enableCommand: 'settings put global send_action_app_error 1',
    disableCommand: 'settings put global send_action_app_error 0',
    enabledValue: '1'
  }
]

export function PrivacyToolsPage() {
  const { t } = useTranslation()
  const showToast = useAppStore((state) => state.showToast)
  const [settings, setSettings] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [privateDns, setPrivateDns] = useState<string>('')
  const [dnsModal, setDnsModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [quickModal, setQuickModal] = useState<'telemetry' | 'security' | null>(null)

  // Load current settings
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setRefreshing(true)
    const newSettings: Record<string, boolean> = {}

    for (const setting of PRIVACY_SETTINGS) {
      try {
        const result = await shell(setting.checkCommand)
        newSettings[setting.id] = result.stdout.trim() === setting.enabledValue
      } catch {
        newSettings[setting.id] = false
      }
    }

    // Check Private DNS
    try {
      const dnsMode = await shell('settings get global private_dns_mode')
      const dnsHost = await shell('settings get global private_dns_specifier')
      if (dnsMode.stdout.trim() === 'hostname' && dnsHost.stdout.trim()) {
        setPrivateDns(dnsHost.stdout.trim())
      } else {
        setPrivateDns('')
      }
    } catch {
      setPrivateDns('')
    }

    setSettings(newSettings)
    setRefreshing(false)
  }

  const toggleSetting = async (setting: PrivacySetting) => {
    setLoading(setting.id)

    try {
      const newValue = !settings[setting.id]
      const command = newValue ? setting.enableCommand : setting.disableCommand
      await shell(command)

      setSettings(prev => ({ ...prev, [setting.id]: newValue }))
      showToast({
        type: 'success',
        title: `${t(`privacyTools.settings.${setting.id}.name`)} ${newValue ? t('filters.statusEnabled') : t('filters.statusDisabled')}`
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: t('toast.error'),
        message: t('toast.operationFailed')
      })
    }

    setLoading(null)
  }

  const setPrivateDnsServer = async (hostname: string) => {
    setLoading('dns')

    try {
      if (hostname) {
        const safeHostname = validateDnsHostname(hostname)
        await shell('settings put global private_dns_mode hostname')
        await shell(`settings put global private_dns_specifier ${safeHostname}`)
        setPrivateDns(safeHostname)
        showToast({
          type: 'success',
          title: t('privacyTools.dns.configured'),
          message: hostname
        })
      } else {
        await shell('settings put global private_dns_mode off')
        await shell('settings put global private_dns_specifier ""')
        setPrivateDns('')
        showToast({
          type: 'success',
          title: t('privacyTools.dns.disabled')
        })
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: t('toast.error'),
        message: t('privacyTools.dns.error')
      })
    }

    setLoading(null)
    setDnsModal(false)
  }

  const applyQuickTelemetry = async () => {
    setLoading('quick-telemetry')
    try {
      for (const setting of PRIVACY_SETTINGS.filter(s => s.category === 'telemetry')) {
        try {
          await shell(setting.disableCommand)
          setSettings(prev => ({ ...prev, [setting.id]: false }))
        } catch (error) {
          console.warn('Errore disabilitando', setting.id, error)
        }
      }
      showToast({ type: 'success', title: t('privacyTools.actions.telemetry.success') })
    } finally {
      setLoading(null)
      setQuickModal(null)
    }
  }

  const applyQuickSecurity = async () => {
    setLoading('quick-security')
    try {
      // Disabilita ADB over network
      await shell('settings put global adb_wifi_enabled 0')
      setSettings(prev => ({ ...prev, adb_over_network: false }))
      showToast({ type: 'success', title: t('privacyTools.actions.security.success') })
    } catch (error) {
      showToast({ type: 'error', title: t('toast.error'), message: t('toast.operationFailed') })
    } finally {
      setLoading(null)
      setQuickModal(null)
    }
  }

  const groupedSettings = PRIVACY_SETTINGS.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = []
    }
    acc[setting.category].push(setting)
    return acc
  }, {} as Record<string, PrivacySetting[]>)

  const categoryLabels = {
    security: { name: t('privacyTools.categories.security'), icon: Lock },
    network: { name: t('privacyTools.categories.network'), icon: Wifi },
    telemetry: { name: t('privacyTools.categories.telemetry'), icon: Eye },
    permissions: { name: t('privacyTools.categories.permissions'), icon: Shield }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto terminal-spacer">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-violet-500/10">
              <Shield className="w-8 h-8 text-violet-500" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
                {t('privacyTools.title')}
              </h1>
              <p className="text-surface-500 mt-1">
                {t('privacyTools.subtitle')}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />}
            onClick={loadSettings}
            loading={refreshing}
          >
            {t('privacyTools.refresh')}
          </Button>
        </div>
      </motion.div>

      {/* Private DNS Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <Card variant="glass" padding="lg">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Globe className="w-6 h-6 text-blue-500" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-surface-900 dark:text-white mb-1">
                {t('privacyTools.dns.title')}
              </h3>
              <p className="text-sm text-surface-500 mb-4">
                {t('privacyTools.dns.description')}
              </p>

              {privateDns ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {privateDns}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDnsModal(true)}
                  >
                    {t('privacyTools.dns.change')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPrivateDnsServer('')}
                    loading={loading === 'dns'}
                  >
                    {t('privacyTools.dns.disable')}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setDnsModal(true)}
                >
                  {t('privacyTools.dns.configure')}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Settings by Category */}
      <div className="space-y-8">
        {Object.entries(groupedSettings).map(([category, categorySettings], categoryIndex) => {
          const categoryInfo = categoryLabels[category as keyof typeof categoryLabels]
          const CategoryIcon = categoryInfo.icon

          return (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + categoryIndex * 0.05 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <CategoryIcon className="w-5 h-5 text-surface-500" strokeWidth={1.5} />
                <h2 className="font-semibold text-surface-900 dark:text-white">
                  {categoryInfo.name}
                </h2>
              </div>

              <div className="space-y-3">
                {categorySettings.map(setting => {
                  const Icon = setting.icon
                  const isEnabled = settings[setting.id] ?? false
                  const isLoading = loading === setting.id

                  return (
                    <Card key={setting.id} variant="glass" padding="md">
                      <div className="flex items-center gap-4">
                        <div className={`
                          p-2.5 rounded-xl
                          ${isEnabled ? 'bg-emerald-500/10' : 'bg-surface-500/10'}
                        `}>
                          <Icon
                            className={`w-5 h-5 ${isEnabled ? 'text-emerald-500' : 'text-surface-400'}`}
                            strokeWidth={1.5}
                          />
                        </div>

                        <div className="flex-1">
                          <h3 className="font-medium text-surface-900 dark:text-white">
                            {t(`privacyTools.settings.${setting.id}.name`)}
                          </h3>
                          <p className="text-sm text-surface-500">
                            {t(`privacyTools.settings.${setting.id}.description`)}
                          </p>
                          {setting.warning && (
                            <p className="text-xs text-amber-500 mt-1">
                              ⚠️ {setting.warning}
                            </p>
                          )}
                        </div>

                        <Switch
                          checked={isEnabled}
                          onChange={() => toggleSetting(setting)}
                          loading={isLoading}
                        />
                      </div>
                    </Card>
                  )
                })}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8"
      >
        <h2 className="font-semibold text-surface-900 dark:text-white mb-4">
          {t('privacyTools.actions.title')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <QuickActionCard
            icon={EyeOff}
            title={t('privacyTools.actions.telemetry.title')}
            description={t('privacyTools.actions.telemetry.desc')}
            onClick={() => setQuickModal('telemetry')}
            loading={loading === 'quick-telemetry'}
            color="violet"
          />

          <QuickActionCard
            icon={Lock}
            title={t('privacyTools.actions.security.title')}
            description={t('privacyTools.actions.security.desc')}
            onClick={() => setQuickModal('security')}
            loading={loading === 'quick-security'}
            color="blue"
          />
        </div>
      </motion.div>

      {/* Quick Actions Modals */}
      <Modal
        isOpen={quickModal === 'telemetry'}
        onClose={() => setQuickModal(null)}
        title={t('privacyTools.actions.telemetry.modalTitle')}
        size="lg"
      >
        <p className="text-sm text-surface-500 mb-4">
          {t('privacyTools.actions.telemetry.modalDesc')}
        </p>
        <ul className="list-disc list-inside text-sm text-surface-500 space-y-1 mb-4">
          <li>{t('privacyTools.settings.usage_stats.name')}</li>
          <li>{t('privacyTools.settings.crash_reports.name')}</li>
          <li>{t('privacyTools.actions.telemetry.automatedReporting')}</li>
        </ul>
        <ModalActions>
          <Button variant="ghost" onClick={() => setQuickModal(null)}>
            {t('privacyTools.cancel')}
          </Button>
          <Button
            onClick={applyQuickTelemetry}
            loading={loading === 'quick-telemetry'}
          >
            {t('privacyTools.actions.telemetry.apply')}
          </Button>
        </ModalActions>
      </Modal>

      <Modal
        isOpen={quickModal === 'security'}
        onClose={() => setQuickModal(null)}
        title={t('privacyTools.actions.security.modalTitle')}
        size="lg"
      >
        <p className="text-sm text-surface-500 mb-4">
          {t('privacyTools.actions.security.modalDesc')}
        </p>
        <ul className="list-disc list-inside text-sm text-surface-500 space-y-1 mb-4">
          <li>{t('privacyTools.settings.adb_over_network.name')}</li>
        </ul>
        <ModalActions>
          <Button variant="ghost" onClick={() => setQuickModal(null)}>
            {t('privacyTools.cancel')}
          </Button>
          <Button
            onClick={applyQuickSecurity}
            loading={loading === 'quick-security'}
          >
            {t('privacyTools.actions.security.apply')}
          </Button>
        </ModalActions>
      </Modal>

      {/* DNS Modal */}
      <Modal
        isOpen={dnsModal}
        onClose={() => setDnsModal(false)}
        title={t('privacyTools.dns.modalTitle')}
        size="lg"
      >
        <p className="text-sm text-surface-500 mb-6">
          {t('privacyTools.dns.modalDesc')}
        </p>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {PRIVATE_DNS_SERVERS.map(server => (
            <button
              key={server.id}
              onClick={() => setPrivateDnsServer(server.hostname)}
              className={`
                w-full text-left p-4 rounded-xl border transition-all
                ${privateDns === server.hostname
                  ? 'border-accent-500 bg-accent-500/5'
                  : 'border-surface-200 dark:border-white/10 hover:border-accent-500/50'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-surface-900 dark:text-white">
                  {t(`privacyTools.dnsServers.${server.id}.name`)}
                </h4>
                {privateDns === server.hostname && (
                  <CheckCircle2 className="w-5 h-5 text-accent-500" strokeWidth={1.5} />
                )}
              </div>
              <p className="text-sm text-surface-500 mb-2">{t(`privacyTools.dnsServers.${server.id}.description`)}</p>
              <div className="flex flex-wrap gap-1">
                {server.features.map((feature, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded bg-surface-100 dark:bg-white/5 text-surface-600 dark:text-surface-400"
                  >
                    {feature}
                  </span>
                ))}
              </div>
              <p className="text-xs text-surface-400 mt-2 font-mono">{server.hostname}</p>
            </button>
          ))}
        </div>

        <ModalActions>
          <Button variant="ghost" onClick={() => setDnsModal(false)}>
            {t('privacyTools.cancel')}
          </Button>
        </ModalActions>
      </Modal>
    </div>
  )
}

interface QuickActionCardProps {
  icon: typeof Shield
  title: string
  description: string
  onClick: () => void
  loading?: boolean
  color: 'violet' | 'blue' | 'emerald' | 'amber'
}

function QuickActionCard({ icon: Icon, title, description, onClick, loading, color }: QuickActionCardProps) {
  const colors = {
    violet: 'bg-violet-500/10 text-violet-500 hover:border-violet-500/50',
    blue: 'bg-blue-500/10 text-blue-500 hover:border-blue-500/50',
    emerald: 'bg-emerald-500/10 text-emerald-500 hover:border-emerald-500/50',
    amber: 'bg-amber-500/10 text-amber-500 hover:border-amber-500/50'
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`
        w-full text-left glass-card p-4 transition-all group
        ${colors[color].split(' ').slice(2).join(' ')}
        disabled:opacity-50
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colors[color].split(' ').slice(0, 2).join(' ')}`}>
          {loading ? (
            <RefreshCw className={`w-6 h-6 animate-spin ${colors[color].split(' ')[1]}`} strokeWidth={1.5} />
          ) : (
            <Icon className={`w-6 h-6 ${colors[color].split(' ')[1]}`} strokeWidth={1.5} />
          )}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-surface-900 dark:text-white">{title}</h4>
          <p className="text-sm text-surface-500">{description}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-surface-400 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
      </div>
    </button>
  )
}

