/**
 * Root Tools Page
 * Strumenti avanzati che richiedono accesso root
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Shield,
  FileText,
  HardDrive,
  RefreshCw,
  Lock
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal, ModalActions } from '@/components/ui/Modal'
import { shell } from '@/services/adb-client'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/stores/i18nStore'
import { HOSTS_LEVELS, getListsForLevel, type HostsLevel, generateHostsFile } from '@/data/hosts-lists'

export function RootToolsPage() {
  const { t } = useTranslation()
  const showToast = useAppStore((state) => state.showToast)
  const [hasRoot, setHasRoot] = useState<boolean | null>(null)
  const [checkingRoot, setCheckingRoot] = useState(true)
  const [hostsModal, setHostsModal] = useState(false)
  const [cleanModal, setCleanModal] = useState(false)
  const [selectedHostsLevel, setSelectedHostsLevel] = useState<HostsLevel>('standard')
  const [installing, setInstalling] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResults, setCleanResults] = useState<{ path: string; size: string }[]>([])

  // Check root access on mount
  useEffect(() => {
    checkRootAccess()
  }, [])

  const checkRootAccess = async () => {
    setCheckingRoot(true)
    try {
      const result = await shell('su -c "id"')
      setHasRoot(result.stdout.includes('uid=0'))
    } catch {
      setHasRoot(false)
    }
    setCheckingRoot(false)
  }

  const installHosts = async () => {
    setInstalling(true)

    try {
      // Generate hosts content
      showToast({ type: 'info', title: t('rootTools.hosts.downloading'), duration: 0 })
      const hostsContent = await generateHostsFile(selectedHostsLevel)

      // Create temp file and push to device
      showToast({ type: 'info', title: t('rootTools.hosts.installing'), duration: 0 })

      // Write to temp location first
      const tempPath = '/data/local/tmp/hosts'
      const encoder = new TextEncoder()
      const hostsBytes = encoder.encode(hostsContent)

      // Use echo with base64 to write the file (workaround for pushing)
      const base64 = btoa(String.fromCharCode(...hostsBytes))
      await shell(`echo "${base64}" | base64 -d > ${tempPath}`)

      // Copy to system with root
      await shell(`su -c "mount -o rw,remount /system"`)
      await shell(`su -c "cp ${tempPath} /system/etc/hosts"`)
      await shell(`su -c "chmod 644 /system/etc/hosts"`)
      await shell(`su -c "mount -o ro,remount /system"`)

      // Clean up
      await shell(`rm ${tempPath}`)

      showToast({
        type: 'success',
        title: t('rootTools.hosts.success'),
        message: `${t('rootTools.hosts.level')}: ${HOSTS_LEVELS.find(l => l.id === selectedHostsLevel)?.name}`
      })

    } catch (error) {
      console.error('Hosts install error:', error)
      showToast({
        type: 'error',
        title: 'Errore installazione',
        message: error instanceof Error ? error.message : 'Errore sconosciuto'
      })
    }

    setInstalling(false)
    setHostsModal(false)
  }

  const performDeepClean = async () => {
    setCleaning(true)
    setCleanResults([])

    const cleanPaths = [
      { path: '/data/local/tmp', name: t('rootTools.clean.items.temp') },
      { path: '/data/data/*/cache', name: t('rootTools.clean.items.appCache') },
      { path: '/data/data/*/code_cache', name: t('rootTools.clean.items.codeCache') },
      { path: '/sdcard/DCIM/.thumbnails', name: t('rootTools.clean.items.thumbnails') },
      { path: '/sdcard/Android/data/*/cache', name: t('rootTools.clean.items.externalCache') },
    ]

    const results: { path: string; size: string }[] = []

    for (const item of cleanPaths) {
      try {
        // Get size before cleaning
        const sizeResult = await shell(`su -c "du -sh ${item.path} 2>/dev/null | cut -f1"`)
        const size = sizeResult.stdout.trim() || '0'

        // Clean
        await shell(`su -c "rm -rf ${item.path}/* 2>/dev/null"`)

        results.push({ path: item.name, size })
      } catch {
        // Path might not exist, ignore
      }
    }

    setCleanResults(results)
    setCleaning(false)

    const totalCleaned = results.length
    showToast({
      type: 'success',
      title: t('rootTools.clean.complete'),
      message: `${totalCleaned} ${t('rootTools.clean.areas')}`
    })
  }

  if (checkingRoot) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw className="w-8 h-8 text-accent-500" strokeWidth={1.5} />
        </motion.div>
      </div>
    )
  }

  if (!hasRoot) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Lock className="w-10 h-10 text-amber-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
            {t('rootTools.noRoot.title')}
          </h2>
          <p className="text-surface-500 max-w-md mx-auto mb-8">
            {t('rootTools.noRoot.description')}
          </p>
          <Button
            variant="secondary"
            icon={<RefreshCw className="w-4 h-4" strokeWidth={1.5} />}
            onClick={checkRootAccess}
          >
            {t('rootTools.noRoot.check')}
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto terminal-spacer">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-orange-500/10">
            <Wrench className="w-8 h-8 text-orange-500" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
              {t('rootTools.title')}
            </h1>
            <p className="text-surface-500 mt-1">
              {t('rootTools.subtitle')}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Root Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <Card variant="glass" padding="md" className="glow-emerald">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-medium text-surface-900 dark:text-white">
                {t('rootTools.status.available')}
              </p>
              <p className="text-sm text-surface-500">
                {t('rootTools.status.description')}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Tools Grid */}
      <div className="space-y-6">
        {/* Hosts File */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-surface-500" strokeWidth={1.5} />
            {t('rootTools.hosts.title')}
          </h2>

          <Card variant="glass" padding="lg">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <FileText className="w-6 h-6 text-blue-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-surface-900 dark:text-white mb-1">
                  {t('rootTools.hosts.cardTitle')}
                </h3>
                <p className="text-sm text-surface-500 mb-4">
                  {t('rootTools.hosts.description')}
                </p>
                <Button onClick={() => setHostsModal(true)}>
                  {t('rootTools.hosts.configure')}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Deep Clean */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-surface-500" strokeWidth={1.5} />
            {t('rootTools.clean.title')}
          </h2>

          <Card variant="glass" padding="lg">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-500/10">
                <HardDrive className="w-6 h-6 text-red-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-surface-900 dark:text-white mb-1">
                  {t('rootTools.clean.cardTitle')}
                </h3>
                <p className="text-sm text-surface-500 mb-4">
                  {t('rootTools.clean.description')}
                </p>
                <Button
                  variant="danger"
                  onClick={() => setCleanModal(true)}
                >
                  {t('rootTools.clean.start')}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Warning */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                {t('rootTools.warning.title')}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-500">
                {t('rootTools.warning.description')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Hosts Modal */}
      <Modal
        isOpen={hostsModal}
        onClose={() => setHostsModal(false)}
        title={t('rootTools.hosts.modalTitle')}
        size="lg"
      >
        <p className="text-sm text-surface-500 mb-6">
          {t('rootTools.hosts.modalDesc')}
        </p>

        <div className="space-y-3 mb-6">
          {HOSTS_LEVELS.map(level => {
            const lists = getListsForLevel(level.id)
            const totalEntries = lists.reduce((sum, l) => sum + l.estimatedEntries, 0)

            return (
              <button
                key={level.id}
                onClick={() => setSelectedHostsLevel(level.id)}
                className={`
                  w-full text-left p-4 rounded-xl border transition-all
                  ${selectedHostsLevel === level.id
                    ? 'border-accent-500 bg-accent-500/5'
                    : 'border-surface-200 dark:border-white/10 hover:border-accent-500/50'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${level.color.replace('text-', 'bg-')}`} />
                    <h4 className="font-medium text-surface-900 dark:text-white">
                      {t(`rootTools.hostsLevels.${level.id}.name`)}
                    </h4>
                  </div>
                  <span className="text-xs text-surface-500">
                    {t('rootTools.hosts.domainsCount', { count: (totalEntries / 1000).toFixed(0) })}
                  </span>
                </div>
                <p className="text-sm text-surface-500 mb-2">{t(`rootTools.hostsLevels.${level.id}.description`)}</p>
                {level.warning && (
                  <p className={`text-xs ${level.color}`}>⚠️ {t(`rootTools.hostsLevels.${level.id}.warning`)}</p>
                )}
              </button>
            )
          })}
        </div>

        <ModalActions>
          <Button variant="ghost" onClick={() => setHostsModal(false)}>
            {t('privacyTools.cancel')}
          </Button>
          <Button onClick={installHosts} loading={installing}>
            {t('rootTools.hosts.install')}
          </Button>
        </ModalActions>
      </Modal>

      {/* Clean Modal */}
      <Modal
        isOpen={cleanModal}
        onClose={() => !cleaning && setCleanModal(false)}
        title={t('rootTools.clean.modalTitle')}
        size="md"
      >
        {!cleaning && cleanResults.length === 0 ? (
          <>
            <p className="text-surface-500 mb-4">
              {t('rootTools.clean.modalDesc')}
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                <Trash2 className="w-4 h-4 text-surface-400" strokeWidth={1.5} />
                {t('rootTools.clean.items.temp')}
              </li>
              <li className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                <Trash2 className="w-4 h-4 text-surface-400" strokeWidth={1.5} />
                {t('rootTools.clean.items.appCache')}
              </li>
              <li className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                <Trash2 className="w-4 h-4 text-surface-400" strokeWidth={1.5} />
                {t('rootTools.clean.items.thumbnails')}
              </li>
              <li className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                <Trash2 className="w-4 h-4 text-surface-400" strokeWidth={1.5} />
                {t('rootTools.clean.items.externalCache')}
              </li>
            </ul>
            <ModalActions>
              <Button variant="ghost" onClick={() => setCleanModal(false)}>
                {t('privacyTools.cancel')}
              </Button>
              <Button variant="danger" onClick={performDeepClean}>
                {t('rootTools.clean.start')}
              </Button>
            </ModalActions>
          </>
        ) : cleaning ? (
          <div className="text-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 mx-auto mb-4"
            >
              <RefreshCw className="w-12 h-12 text-accent-500" strokeWidth={1.5} />
            </motion.div>
            <p className="text-surface-900 dark:text-white font-medium">
              {t('rootTools.clean.cleaning')}
            </p>
            <p className="text-sm text-surface-500">
              {t('rootTools.clean.dontClose')}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" strokeWidth={1.5} />
              <p className="font-medium text-surface-900 dark:text-white">
                {t('rootTools.clean.complete')}
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {cleanResults.map((result, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-100 dark:bg-white/5"
                >
                  <span className="text-sm text-surface-700 dark:text-surface-300">
                    {result.path}
                  </span>
                  <span className="text-sm font-medium text-emerald-500">
                    {result.size}
                  </span>
                </div>
              ))}
            </div>

            <ModalActions>
              <Button onClick={() => { setCleanModal(false); setCleanResults([]) }}>
                {t('rootTools.clean.close')}
              </Button>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  )
}

