/**
 * History Page
 * Storico azioni utente con timeline e export
 */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History,
  Smartphone,
  Package,
  Calendar,
  Download,
  RefreshCw,
  RotateCcw,
  Filter,
  ChevronDown,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal, ModalActions } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/authStore'
import { useAdbStore } from '@/stores/adbStore'
import { useAppStore } from '@/stores/appStore'
import { useAdb } from '@/hooks/useAdb'
import type { UserAction } from '@/services/supabase'
import { useTranslation } from '@/stores/i18nStore'

type ActionFilter = 'all' | 'disable' | 'enable' | 'uninstall' | 'reinstall'

export function HistoryPage() {
  const { user, isAuthenticated, loadUserData, userActions, userDevices } = useAuthStore()
  const { togglePackage } = useAdb()
  const showToast = useAppStore((state) => state.showToast)
  const currentDeviceId = useAdbStore((state) => state.currentDeviceId)
  const { t, language } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ActionFilter>('all')
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [restoreModal, setRestoreModal] = useState<{ open: boolean; deviceId?: string }>({ open: false })
  const [restoring, setRestoring] = useState(false)

  // Refresh data on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      setLoading(true)
      loadUserData().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, user, loadUserData])

  // Filter actions
  const filteredActions = useMemo(() => {
    return userActions.filter(action => {
      if (filter !== 'all' && action.action !== filter) return false
      if (selectedDevice && action.device_id !== selectedDevice) return false
      return true
    })
  }, [userActions, filter, selectedDevice])

  // Group actions by date
  const groupedActions = useMemo(() => {
    const groups: Record<string, UserAction[]> = {}

    filteredActions.forEach(action => {
      const date = new Date(action.created_at).toLocaleDateString(language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(action)
    })

    return groups
  }, [filteredActions])

  // Get disabled packages for current device
  const disabledPackages = useMemo(() => {
    if (!currentDeviceId) return []

    const packageStates: Record<string, boolean> = {}

    userActions
      .filter(a => a.device_id === currentDeviceId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach(action => {
        if (action.action === 'disable') {
          packageStates[action.package_name] = true
        } else if (action.action === 'enable') {
          packageStates[action.package_name] = false
        }
      })

    return Object.entries(packageStates)
      .filter(([, isDisabled]) => isDisabled)
      .map(([pkg]) => pkg)
  }, [userActions, currentDeviceId])

  // Export to JSON
  const exportToJson = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      devices: userDevices,
      actions: userActions
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `adbzero-history-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    showToast({ type: 'success', title: t('history.historyExported') })
  }

  // Export to CSV
  const exportToCsv = () => {
    const headers = [
      t('history.date'),
      t('history.device'),
      t('history.package'),
      t('history.action')
    ]
    const rows = userActions.map(action => {
      const device = userDevices.find(d => d.id === action.device_id)
      return [
        new Date(action.created_at).toISOString(),
        device ? `${device.manufacturer} ${device.model}` : action.device_id,
        action.package_name,
        action.action
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `adbzero-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    showToast({ type: 'success', title: t('history.historyExported') })
  }

  // Restore all disabled packages
  const restoreAllPackages = async () => {
    if (disabledPackages.length === 0) return

    setRestoring(true)

    let success = 0
    let failed = 0

    for (const pkg of disabledPackages) {
      try {
        await togglePackage(pkg, true)
        success++
      } catch {
        failed++
      }

      // Small delay
      await new Promise(r => setTimeout(r, 100))
    }

    setRestoring(false)
    setRestoreModal({ open: false })

    showToast({
      type: failed > 0 ? 'warning' : 'success',
      title: t('history.restoreComplete'),
      message: `${t('history.packagesRestored', { success })}${failed > 0 ? `, ${t('history.packagesFailed', { failed })}` : ''}`
    })

    loadUserData()
  }

  const filterLabels: Record<ActionFilter, string> = {
    all: t('history.allActions'),
    disable: t('history.disables'),
    enable: t('history.enables'),
    uninstall: t('history.uninstalls'),
    reinstall: t('history.reinstalls')
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-500/10 flex items-center justify-center">
            <History className="w-10 h-10 text-surface-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
            {t('history.loginToSeeHistory')}
          </h2>
          <p className="text-surface-500 max-w-md mx-auto mb-8">
            {t('history.loginDescription')}
          </p>
          <Button
            onClick={() => useAuthStore.getState().setShowAuthModal(true, 'login')}
          >
            {t('auth.login')}
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto terminal-spacer">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10">
              <History className="w-8 h-8 text-indigo-500" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
                {t('history.title')}
              </h1>
              <p className="text-surface-500 mt-1">
                {userActions.length} {t('history.actions')}, {userDevices.length} {t('history.devices')}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />}
              onClick={() => loadUserData()}
              loading={loading}
            >
              {t('history.refresh')}
            </Button>

            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="w-4 h-4" strokeWidth={1.5} />}
                onClick={() => document.getElementById('export-menu')?.classList.toggle('hidden')}
              >
                {t('history.export')}
              </Button>
              <div
                id="export-menu"
                className="hidden absolute right-0 mt-2 w-40 py-2 bg-white dark:bg-surface-800 rounded-xl shadow-elevated border border-surface-200 dark:border-white/10 z-10"
              >
                <button
                  onClick={exportToJson}
                  className="w-full px-4 py-2 text-left text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/5"
                >
                  {t('history.exportJson')}
                </button>
                <button
                  onClick={exportToCsv}
                  className="w-full px-4 py-2 text-left text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/5"
                >
                  {t('history.exportCsv')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Devices Overview */}
      {userDevices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-surface-500" strokeWidth={1.5} />
            {t('history.yourDevices')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userDevices.map(device => {
              const deviceActions = userActions.filter(a => a.device_id === device.id)
              const isCurrentDevice = device.id === currentDeviceId

              return (
                <Card
                  key={device.id}
                  variant="glass"
                  padding="md"
                  className={`cursor-pointer transition-all ${selectedDevice === device.id
                    ? 'ring-2 ring-accent-500'
                    : 'hover:border-surface-300 dark:hover:border-white/20'
                    }`}
                  onClick={() => setSelectedDevice(
                    selectedDevice === device.id ? null : device.id
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center
                        ${isCurrentDevice ? 'bg-emerald-500/10' : 'bg-surface-500/10'}
                      `}>
                        <Smartphone
                          className={`w-5 h-5 ${isCurrentDevice ? 'text-emerald-500' : 'text-surface-400'}`}
                          strokeWidth={1.5}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-surface-900 dark:text-white">
                          {device.model}
                        </p>
                        <p className="text-xs text-surface-500">
                          {device.manufacturer}
                        </p>
                      </div>
                    </div>
                    {isCurrentDevice && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                        {t('history.connected')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-surface-500">
                      Android {device.android_version}
                    </span>
                    <span className="text-surface-500">
                      {deviceActions.length} {t('history.actions')}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Restore Section */}
      {disabledPackages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <Card variant="glass" padding="md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10">
                  <RotateCcw className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-medium text-surface-900 dark:text-white">
                    {t('history.disabledPackages', { count: disabledPackages.length })}
                  </p>
                  <p className="text-sm text-surface-500">
                    {t('history.restoreAllOnDevice')}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setRestoreModal({ open: true })}
              >
                {t('history.restoreAll')}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-4 mb-6"
      >
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            icon={<Filter className="w-4 h-4" strokeWidth={1.5} />}
            onClick={() => setShowFilterMenu(!showFilterMenu)}
          >
            {filterLabels[filter]}
            <ChevronDown className="w-4 h-4 ml-1" strokeWidth={1.5} />
          </Button>

          <AnimatePresence>
            {showFilterMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-0 mt-2 w-48 py-2 bg-white dark:bg-surface-800 rounded-xl shadow-elevated border border-surface-200 dark:border-white/10 z-10"
              >
                {(Object.keys(filterLabels) as ActionFilter[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setFilter(key)
                      setShowFilterMenu(false)
                    }}
                    className={`
                      w-full px-4 py-2 text-left text-sm transition-colors
                      ${filter === key
                        ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                        : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/5'
                      }
                    `}
                  >
                    {filterLabels[key]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {selectedDevice && (
          <button
            onClick={() => setSelectedDevice(null)}
            className="text-sm text-accent-500 hover:text-accent-400"
          >
            {t('history.showAllDevices')}
          </button>
        )}
      </motion.div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw className="w-8 h-8 text-accent-500" strokeWidth={1.5} />
          </motion.div>
        </div>
      ) : Object.keys(groupedActions).length === 0 ? (
        <div className="text-center py-20">
          <History className="w-12 h-12 mx-auto text-surface-400 mb-4" strokeWidth={1} />
          <p className="text-surface-500">{t('history.noActionsRecorded')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedActions).map(([date, actions]) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-4 h-4 text-surface-400" strokeWidth={1.5} />
                <h3 className="font-medium text-surface-900 dark:text-white">
                  {date}
                </h3>
                <span className="text-sm text-surface-500">
                  ({actions.length} {t('history.actions')})
                </span>
              </div>

              <div className="space-y-2 ml-7 border-l-2 border-surface-200 dark:border-white/10 pl-6">
                {actions.map((action) => {
                  const device = userDevices.find(d => d.id === action.device_id)
                  const ActionIcon = action.action === 'disable' || action.action === 'uninstall'
                    ? XCircle
                    : CheckCircle2
                  const actionColor = action.action === 'disable' || action.action === 'uninstall'
                    ? 'text-red-500 bg-red-500/10'
                    : 'text-emerald-500 bg-emerald-500/10'

                  return (
                    <div
                      key={action.id}
                      className="relative flex items-start gap-4 p-4 rounded-xl bg-surface-50 dark:bg-white/5"
                    >
                      {/* Timeline dot */}
                      <div className={`absolute -left-[1.875rem] top-5 w-2.5 h-2.5 rounded-full ${actionColor.split(' ')[1]}`} />

                      <div className={`p-2 rounded-lg ${actionColor.split(' ')[1]}`}>
                        <ActionIcon className={`w-4 h-4 ${actionColor.split(' ')[0]}`} strokeWidth={1.5} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-surface-900 dark:text-white">
                            {action.action === 'disable' ? t('history.disabled') :
                              action.action === 'enable' ? t('history.enabled') :
                                action.action === 'uninstall' ? t('history.uninstalled') : t('history.reinstalled')}
                          </p>
                          <span className="text-xs text-surface-400">
                            {new Date(action.created_at).toLocaleTimeString(language, {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-surface-500 font-mono truncate">
                          {action.package_name}
                        </p>
                        {device && (
                          <p className="text-xs text-surface-400 mt-1">
                            {device.manufacturer} {device.model}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Restore Modal */}
      <Modal
        isOpen={restoreModal.open}
        onClose={() => !restoring && setRestoreModal({ open: false })}
        title={t('history.restorePackages')}
        size="md"
      >
        {restoring ? (
          <div className="text-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 mx-auto mb-4"
            >
              <RefreshCw className="w-12 h-12 text-accent-500" strokeWidth={1.5} />
            </motion.div>
            <p className="text-surface-900 dark:text-white font-medium">
              {t('history.restoreInProgress')}
            </p>
          </div>
        ) : (
          <>
            <p className="text-surface-500 mb-4">
              {t('history.willReEnable', { count: disabledPackages.length })}
            </p>

            <div className="max-h-48 overflow-y-auto space-y-2 mb-6 pr-2">
              {disabledPackages.slice(0, 10).map(pkg => (
                <div
                  key={pkg}
                  className="flex items-center gap-3 p-2 rounded-lg bg-surface-100 dark:bg-white/5"
                >
                  <Package className="w-4 h-4 text-surface-400" strokeWidth={1.5} />
                  <span className="text-sm text-surface-700 dark:text-surface-300 font-mono truncate">
                    {pkg}
                  </span>
                </div>
              ))}
              {disabledPackages.length > 10 && (
                <p className="text-sm text-surface-500 text-center py-2">
                  {t('history.andMorePackages', { count: disabledPackages.length - 10 })}
                </p>
              )}
            </div>

            <ModalActions>
              <Button variant="ghost" onClick={() => setRestoreModal({ open: false })}>
                {t('common.cancel')}
              </Button>
              <Button onClick={restoreAllPackages}>
                {t('history.restorePackagesCount', { count: disabledPackages.length })}
              </Button>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  )
}

