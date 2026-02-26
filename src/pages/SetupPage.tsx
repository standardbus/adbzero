/**
 * Setup Page
 * Guida utente per configurazione driver e risoluzione problemi
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Apple,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  Usb,
  HelpCircle,
  ChevronDown,
  Smartphone
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/stores/i18nStore'

type OS = 'windows' | 'macos' | 'linux' | 'unknown'

interface DriverInfo {
  name: string
  description: string
  url: string
  required: boolean
}

export function SetupPage() {
  const [detectedOS, setDetectedOS] = useState<OS>('unknown')
  const [copiedCommand, setCopiedCommand] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)
  const { showToast } = useAppStore()
  const { t } = useTranslation()

  // Detect OS on mount
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('win')) {
      setDetectedOS('windows')
    } else if (userAgent.includes('mac')) {
      setDetectedOS('macos')
    } else if (userAgent.includes('linux')) {
      setDetectedOS('linux')
    }
  }, [])

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command)
    setCopiedCommand(true)
    showToast({ type: 'success', title: t('setup.copied'), message: t('common.copiedToClipboard') })
    setTimeout(() => setCopiedCommand(false), 2000)
  }

  const downloadScript = () => {
    const scriptUrl = detectedOS === 'windows'
      ? '/scripts/kill-adb-windows.bat'
      : '/scripts/kill-adb-mac.sh'

    const link = document.createElement('a')
    link.href = scriptUrl
    link.download = detectedOS === 'windows' ? 'kill-adb.bat' : 'kill-adb.sh'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast({
      type: 'success',
      title: t('setup.scriptDownloaded'),
      message: t('setup.runBeforeConnect')
    })
  }

  const getOSInfo = () => {
    switch (detectedOS) {
      case 'windows':
        return {
          icon: Monitor,
          name: 'Windows',
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          drivers: [
            {
              name: 'Google USB Driver',
              description: t('setup.googleUsbDriverDesc'),
              url: 'https://developer.android.com/studio/run/win-usb',
              required: true
            },
            {
              name: 'Zadig (WinUSB)',
              description: t('setup.zadigDesc'),
              url: 'https://zadig.akeo.ie/',
              required: false
            },
            {
              name: 'Samsung USB Drivers',
              description: t('setup.samsungDriverDesc'),
              url: 'https://developer.samsung.com/android-usb-driver',
              required: false
            }
          ] as DriverInfo[],
          killCommand: 'adb kill-server',
          instructions: [
            t('setup.windowsInstr1'),
            t('setup.windowsInstr2'),
            t('setup.windowsInstr3'),
            t('setup.windowsInstr4')
          ]
        }
      case 'macos':
        return {
          icon: Apple,
          name: 'macOS',
          color: 'text-surface-400',
          bgColor: 'bg-surface-500/10',
          drivers: [] as DriverInfo[],
          killCommand: 'adb kill-server',
          instructions: [
            t('setup.macNoDrivers'),
            t('setup.macKillAdb'),
            t('setup.macConnectAuthorize')
          ]
        }
      case 'linux':
        return {
          icon: Terminal,
          name: 'Linux',
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
          drivers: [] as DriverInfo[],
          killCommand: 'adb kill-server && sudo systemctl stop adb.service',
          instructions: [
            t('setup.linuxNoDrivers'),
            t('setup.linuxUdev'),
            t('setup.linuxKillAdb'),
            t('setup.linuxPlugdev')
          ]
        }
      default:
        return {
          icon: HelpCircle,
          name: t('setup.systemNotDetected'),
          color: 'text-surface-500',
          bgColor: 'bg-surface-500/10',
          drivers: [] as DriverInfo[],
          killCommand: 'adb kill-server',
          instructions: [t('setup.selectOSAbove')]
        }
    }
  }

  const osInfo = getOSInfo()
  const OSIcon = osInfo.icon

  const faqs = [
    {
      id: 'webusb',
      question: t('setup.faqWebUsbQuestion'),
      answer: t('setup.faqWebUsbAnswer')
    },
    {
      id: 'drivers',
      question: t('setup.faqDriversQuestion'),
      answer: t('setup.faqDriversAnswer')
    },
    {
      id: 'authorize',
      question: t('setup.faqAuthorizeQuestion'),
      answer: t('setup.faqAuthorizeAnswer')
    },
    {
      id: 'xiaomi',
      question: t('setup.faqXiaomiQuestion'),
      answer: t('setup.faqXiaomiAnswer')
    },
    {
      id: 'samsung',
      question: t('setup.faqSamsungQuestion'),
      answer: t('setup.faqSamsungAnswer')
    },
    {
      id: 'chrome',
      question: t('setup.faqBrowserQuestion'),
      answer: t('setup.faqBrowserAnswer')
    }
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
          {t('setup.title')}
        </h1>
        <p className="text-surface-500 mt-1">
          {t('setup.subtitle')}
        </p>
      </motion.div>

      {/* OS Detection Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-14 h-14 rounded-2xl ${osInfo.bgColor} flex items-center justify-center`}>
              <OSIcon className={`w-7 h-7 ${osInfo.color}`} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-surface-900 dark:text-white">
                {t('setup.detectedSystem')}: {osInfo.name}
              </h2>
              <p className="text-sm text-surface-500">
                {t('setup.configureInfo')}
              </p>
            </div>
          </div>

          {/* Quick Fix: Kill ADB */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
                  {t('setup.commonProblem')}
                </h3>
                <p className="text-sm text-surface-600 dark:text-surface-400 mb-3">
                  {t('setup.adbOccupying')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <code className="flex-1 px-4 py-2 bg-surface-900 dark:bg-black/50 text-emerald-400 rounded-lg font-mono text-sm">
                    {osInfo.killCommand}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copyCommand(osInfo.killCommand)}
                    icon={copiedCommand ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  >
                    {copiedCommand ? t('setup.copied') : t('setup.copy')}
                  </Button>
                </div>
                <div className="mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={downloadScript}
                    icon={<Download className="w-4 h-4" />}
                  >
                    {t('setup.downloadScript')}
                  </Button>
                  <p className="text-xs text-surface-500 mt-2">
                    {t('setup.downloadScriptInfo')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-6">
            <h3 className="font-semibold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              {t('setup.stepsToFollow')}
            </h3>
            <ol className="space-y-2">
              {osInfo.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-3 text-sm text-surface-600 dark:text-surface-400">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-500/10 text-accent-500 flex items-center justify-center text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Drivers (Windows only) */}
          {osInfo.drivers.length > 0 && (
            <div>
              <h3 className="font-semibold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
                <Usb className="w-5 h-5 text-blue-500" />
                {t('setup.recommendedDrivers')}
              </h3>
              <div className="space-y-3">
                {osInfo.drivers.map((driver) => (
                  <div
                    key={driver.name}
                    className="flex items-center justify-between p-4 rounded-xl bg-surface-100/50 dark:bg-white/5 border border-surface-200/50 dark:border-white/5"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-surface-900 dark:text-white">
                          {driver.name}
                        </p>
                        {driver.required && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                            {t('setup.recommended')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-surface-500 mt-1">
                        {driver.description}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => window.open(driver.url, '_blank')}
                      icon={<ExternalLink className="w-4 h-4" />}
                    >
                      {t('setup.download')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Phone Setup Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-accent-500/10 flex items-center justify-center">
              <Smartphone className="w-7 h-7 text-accent-500" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-surface-900 dark:text-white">
                {t('setup.phoneConfiguration')}
              </h2>
              <p className="text-sm text-surface-500">
                {t('setup.enableUsbDebug')}
              </p>
            </div>
          </div>

          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center font-semibold">
                1
              </span>
              <div>
                <p className="font-medium text-surface-900 dark:text-white">{t('setup.enableDevOptions')}</p>
                <p className="text-sm text-surface-500 mt-1">
                  {t('setup.devOptionsInstructions')}
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center font-semibold">
                2
              </span>
              <div>
                <p className="font-medium text-surface-900 dark:text-white">{t('setup.enableDebugUsb')}</p>
                <p className="text-sm text-surface-500 mt-1">
                  {t('setup.debugUsbInstructions')}
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center font-semibold">
                3
              </span>
              <div>
                <p className="font-medium text-surface-900 dark:text-white">{t('setup.extraXiaomi')}</p>
                <p className="text-sm text-surface-500 mt-1">
                  {t('setup.xiaomiInstructions')}
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center font-semibold">
                4
              </span>
              <div>
                <p className="font-medium text-surface-900 dark:text-white">{t('setup.authorizePC')}</p>
                <p className="text-sm text-surface-500 mt-1">
                  {t('setup.authorizePCInstructions')}
                </p>
              </div>
            </li>
          </ol>
        </Card>
      </motion.div>

      {/* FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <HelpCircle className="w-7 h-7 text-violet-500" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-surface-900 dark:text-white">
                {t('setup.faq')}
              </h2>
              <p className="text-sm text-surface-500">
                {t('setup.faqAnswers')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {faqs.map((faq) => (
              <div key={faq.id} className="border-b border-surface-200/50 dark:border-white/5 last:border-0">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between py-4 text-left"
                >
                  <span className="font-medium text-surface-900 dark:text-white pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-surface-400 transition-transform ${expandedFaq === faq.id ? 'rotate-180' : ''
                      }`}
                  />
                </button>
                <AnimatePresence>
                  {expandedFaq === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-4 text-sm text-surface-600 dark:text-surface-400">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

