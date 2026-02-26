/**
 * Device Tools Page
 * Strumenti avanzati per personalizzare il dispositivo Android
 */

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Monitor,
  Maximize2,
  Type,
  Zap,
  Battery,
  Clock,
  RotateCcw,
  Check,
  Loader2,
  Smartphone,
  Sun,
  Vibrate,
  Eye,
  Sparkles
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAdb } from '@/hooks/useAdb'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/stores/i18nStore'
import { validateIntegerValue } from '@/services/command-sanitizer'

interface DeviceSettings {
  // Display
  currentDpi: number
  defaultDpi: number
  currentResolution: string
  defaultResolution: string
  fontScale: number

  // Animations
  windowAnimationScale: number
  transitionAnimationScale: number
  animatorDurationScale: number

  // Screen
  screenOffTimeout: number
  adaptiveBrightness: boolean
  stayAwakeWhileCharging: boolean

  // Developer
  showTouches: boolean
  showLayoutBounds: boolean
  forceGpuRendering: boolean
  debugGpuOverdraw: boolean
}

const DPI_PRESETS = [
  { label: 'deviceTools.dpi.compact', value: 480, description: 'deviceTools.dpi.compactDesc' },
  { label: 'deviceTools.dpi.standard', value: 420, description: 'deviceTools.dpi.standardDesc' },
  { label: 'deviceTools.dpi.large', value: 360, description: 'deviceTools.dpi.largeDesc' },
  { label: 'deviceTools.dpi.veryLarge', value: 320, description: 'deviceTools.dpi.veryLargeDesc' },
]

const RESOLUTION_PRESETS = [
  { label: '720p', width: 720, height: 1280 },
  { label: '1080p (FHD)', width: 1080, height: 1920 },
  { label: '1440p (QHD)', width: 1440, height: 2560 },
  { label: '4K (UHD)', width: 2160, height: 3840 },
]

const TIMEOUT_PRESETS = [
  { value: 15000 },
  { value: 30000 },
  { value: 60000 },
  { value: 120000 },
  { value: 300000 },
  { value: 600000 },
  { value: 1800000 },
  { value: 2147483647 },
]

const ANIMATION_SCALES = [
  { label: 'Off', value: 0 },
  { label: '0.5x', value: 0.5 },
  { label: '1x (Default)', value: 1 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2 },
  { label: '5x', value: 5 },
  { label: '10x', value: 10 },
]

const FONT_SCALES = [
  { label: 'deviceTools.fontScale.small', value: 0.85 },
  { label: 'deviceTools.fontScale.default', value: 1.0 },
  { label: 'deviceTools.fontScale.large', value: 1.15 },
  { label: 'deviceTools.fontScale.veryLarge', value: 1.3 },
]

export function DeviceToolsPage() {
  const { isConnected, shell, deviceInfo } = useAdb()
  const { showToast } = useAppStore()
  const { t } = useTranslation()

  const [settings, setSettings] = useState<Partial<DeviceSettings>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const [customDpi, setCustomDpi] = useState('')
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')

  // Load current settings
  const loadSettings = useCallback(async () => {
    if (!isConnected) return

    setLoading(true)
    try {
      const results = await Promise.all([
        shell('wm density'),
        shell('wm size'),
        shell('settings get system font_scale'),
        shell('settings get global window_animation_scale'),
        shell('settings get global transition_animation_scale'),
        shell('settings get global animator_duration_scale'),
        shell('settings get system screen_off_timeout'),
        shell('settings get system screen_brightness_mode'),
        shell('settings get global stay_on_while_plugged_in'),
        shell('settings get system show_touches'),
        shell('settings get system pointer_location'),
        shell('settings get global force_gpu_rendering'),
        shell('settings get developer_options debug_gpu_overdraw'),
      ])

      // Parse DPI
      const dpiMatch = results[0].stdout.match(/Physical density:\s*(\d+)/)
      const dpiOverrideMatch = results[0].stdout.match(/Override density:\s*(\d+)/)
      const defaultDpi = dpiMatch ? parseInt(dpiMatch[1]) : 420
      const currentDpi = dpiOverrideMatch ? parseInt(dpiOverrideMatch[1]) : defaultDpi

      // Parse Resolution
      const resMatch = results[1].stdout.match(/Physical size:\s*(\d+x\d+)/)
      const resOverrideMatch = results[1].stdout.match(/Override size:\s*(\d+x\d+)/)
      const defaultResolution = resMatch ? resMatch[1] : '1080x1920'
      const currentResolution = resOverrideMatch ? resOverrideMatch[1] : defaultResolution

      setSettings({
        currentDpi,
        defaultDpi,
        currentResolution,
        defaultResolution,
        fontScale: parseFloat(results[2].stdout) || 1.0,
        windowAnimationScale: parseFloat(results[3].stdout) || 1.0,
        transitionAnimationScale: parseFloat(results[4].stdout) || 1.0,
        animatorDurationScale: parseFloat(results[5].stdout) || 1.0,
        screenOffTimeout: parseInt(results[6].stdout) || 60000,
        adaptiveBrightness: results[7].stdout.trim() === '1',
        stayAwakeWhileCharging: parseInt(results[8].stdout) > 0,
        showTouches: results[9].stdout.trim() === '1',
        showLayoutBounds: results[10].stdout.trim() === '1',
        forceGpuRendering: results[11].stdout.trim() === '1',
        debugGpuOverdraw: results[12].stdout.trim() !== 'false',
      })

      setCustomDpi(currentDpi.toString())
      const [w, h] = currentResolution.split('x')
      setCustomWidth(w)
      setCustomHeight(h)

    } catch (error) {
      console.error('Error loading settings:', error)
      showToast({ type: 'error', title: t('toast.error'), message: t('toast.operationFailed') })
    } finally {
      setLoading(false)
    }
  }, [isConnected, shell, showToast])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Generic setting change handler
  const changeSetting = async (key: string, command: string, value: any, successMessage: string) => {
    setSavingKey(key)
    try {
      const result = await shell(command)
      if (result.exitCode === 0 || result.stdout === '') {
        setSettings(prev => ({ ...prev, [key]: value }))
        showToast({ type: 'success', title: t('toast.changesSaved'), message: successMessage })
      } else {
        throw new Error(result.stderr || result.stdout)
      }
    } catch (error: any) {
      showToast({ type: 'error', title: t('toast.error'), message: error.message })
    } finally {
      setSavingKey(null)
    }
  }

  // DPI change
  const changeDpi = async (dpi: number) => {
    const safeDpi = validateIntegerValue(dpi, 72, 960, 'DPI')
    await changeSetting('currentDpi', `wm density ${safeDpi}`, safeDpi, t('deviceTools.dpi.success', { value: safeDpi }))
    setCustomDpi(safeDpi.toString())
  }

  const resetDpi = async () => {
    setSavingKey('resetDpi')
    try {
      await shell('wm density reset')
      setSettings(prev => ({ ...prev, currentDpi: prev.defaultDpi }))
      setCustomDpi(settings.defaultDpi?.toString() || '')
      showToast({ type: 'success', title: t('deviceTools.dpi.resetSuccess', { value: settings.defaultDpi || 0 }), message: '' })
    } catch (error: any) {
      showToast({ type: 'error', title: t('toast.error'), message: error.message })
    } finally {
      setSavingKey(null)
    }
  }

  // Resolution change
  const changeResolution = async (width: number, height: number) => {
    const safeWidth = validateIntegerValue(width, 240, 7680, 'Width')
    const safeHeight = validateIntegerValue(height, 240, 7680, 'Height')
    const resolution = `${safeWidth}x${safeHeight}`
    await changeSetting('currentResolution', `wm size ${resolution}`, resolution, t('deviceTools.resolution.success', { value: resolution }))
    setCustomWidth(safeWidth.toString())
    setCustomHeight(safeHeight.toString())
  }

  const resetResolution = async () => {
    setSavingKey('resetRes')
    try {
      await shell('wm size reset')
      setSettings(prev => ({ ...prev, currentResolution: prev.defaultResolution }))
      const [w, h] = (settings.defaultResolution || '1080x1920').split('x')
      setCustomWidth(w)
      setCustomHeight(h)
      showToast({ type: 'success', title: t('deviceTools.resolution.resetSuccess', { value: settings.defaultResolution || '' }), message: '' })
    } catch (error: any) {
      showToast({ type: 'error', title: t('toast.error'), message: error.message })
    } finally {
      setSavingKey(null)
    }
  }

  // Animation scales
  const changeAnimationScale = async (type: 'window' | 'transition' | 'animator', scale: number) => {
    const commands: Record<string, string> = {
      window: 'settings put global window_animation_scale',
      transition: 'settings put global transition_animation_scale',
      animator: 'settings put global animator_duration_scale',
    }
    const commandsLabels: Record<string, string> = {
      window: t('deviceTools.animations.window'),
      transition: t('deviceTools.animations.transition'),
      animator: t('deviceTools.animations.animator'),
    }
    const keys: Record<string, keyof DeviceSettings> = {
      window: 'windowAnimationScale',
      transition: 'transitionAnimationScale',
      animator: 'animatorDurationScale',
    }
    await changeSetting(keys[type], `${commands[type]} ${scale}`, scale, t('deviceTools.animations.success', { type: commandsLabels[type], value: scale }))
  }

  const disableAllAnimations = async () => {
    setSavingKey('allAnimations')
    try {
      await shell('settings put global window_animation_scale 0')
      await shell('settings put global transition_animation_scale 0')
      await shell('settings put global animator_duration_scale 0')
      setSettings(prev => ({
        ...prev,
        windowAnimationScale: 0,
        transitionAnimationScale: 0,
        animatorDurationScale: 0,
      }))
      showToast({ type: 'success', title: t('deviceTools.animations.disabledSuccess'), message: '' })
    } catch (error: any) {
      showToast({ type: 'error', title: t('toast.error'), message: error.message })
    } finally {
      setSavingKey(null)
    }
  }

  const resetAllAnimations = async () => {
    setSavingKey('allAnimations')
    try {
      await shell('settings put global window_animation_scale 1')
      await shell('settings put global transition_animation_scale 1')
      await shell('settings put global animator_duration_scale 1')
      setSettings(prev => ({
        ...prev,
        windowAnimationScale: 1,
        transitionAnimationScale: 1,
        animatorDurationScale: 1,
      }))
      showToast({ type: 'success', title: t('deviceTools.animations.resetSuccess'), message: '' })
    } catch (error: any) {
      showToast({ type: 'error', title: t('toast.error'), message: error.message })
    } finally {
      setSavingKey(null)
    }
  }

  if (!isConnected) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Smartphone className="w-16 h-16 mx-auto text-surface-400 mb-4" strokeWidth={1} />
          <p className="text-surface-500">{t('deviceTools.connectDevice')}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent-500" />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
              {t('deviceTools.title')}
            </h1>
            <p className="text-surface-500 mt-1">
              {t('deviceTools.subtitle', { model: deviceInfo?.model || 'Android' })}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={loadSettings}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            {t('deviceTools.refresh')}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* DPI Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="glass" className="p-6 h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold text-surface-900 dark:text-white">{t('deviceTools.dpi.title')}</h2>
                <p className="text-xs text-surface-500">
                  {t('deviceTools.dpi.current')}: <span className="font-mono font-semibold">{settings.currentDpi}</span>
                  {settings.currentDpi !== settings.defaultDpi && (
                    <span className="text-amber-500"> ({t('deviceTools.dpi.default')}: {settings.defaultDpi})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {DPI_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => changeDpi(preset.value)}
                  disabled={savingKey !== null}
                  className={`
                    p-3 rounded-xl text-left transition-all duration-200 border
                    ${settings.currentDpi === preset.value
                      ? 'bg-accent-500/10 border-accent-500/50 text-accent-600 dark:text-accent-400'
                      : 'bg-surface-100/50 dark:bg-white/5 border-transparent hover:bg-surface-200/50 dark:hover:bg-white/10'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{t(preset.label)}</span>
                    <span className="text-xs font-mono text-surface-500">{preset.value}</span>
                  </div>
                  <p className="text-xs text-surface-500 mt-1">{t(preset.description)}</p>
                  {settings.currentDpi === preset.value && (
                    <Check className="w-4 h-4 text-accent-500 absolute top-2 right-2" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <input
                type="number"
                value={customDpi}
                onChange={(e) => setCustomDpi(e.target.value)}
                placeholder={t('deviceTools.dpi.custom')}
                className="flex-1 px-3 py-2.5 rounded-xl bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/50"
              />
              <Button
                variant="primary"
                onClick={() => changeDpi(parseInt(customDpi))}
                disabled={!customDpi || savingKey !== null}
                loading={savingKey === 'currentDpi'}
                className="sm:w-32"
              >
                {t('deviceTools.dpi.apply')}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetDpi}
              disabled={settings.currentDpi === settings.defaultDpi || savingKey !== null}
              loading={savingKey === 'resetDpi'}
              icon={<RotateCcw className="w-4 h-4" />}
              className="w-full"
            >
              {t('deviceTools.dpi.reset', { value: settings.defaultDpi || 0 })}
            </Button>
          </Card>
        </motion.div>

        {/* Resolution Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card variant="glass" className="p-6 h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Maximize2 className="w-5 h-5 text-violet-500" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold text-surface-900 dark:text-white">{t('deviceTools.resolution.title')}</h2>
                <p className="text-xs text-surface-500">
                  {t('deviceTools.resolution.current')}: <span className="font-mono font-semibold">{settings.currentResolution}</span>
                  {settings.currentResolution !== settings.defaultResolution && (
                    <span className="text-amber-500"> ({t('deviceTools.resolution.default')}: {settings.defaultResolution})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {RESOLUTION_PRESETS.map((preset) => {
                const resStr = `${preset.width}x${preset.height}`
                const isActive = settings.currentResolution === resStr
                return (
                  <button
                    key={preset.label}
                    onClick={() => changeResolution(preset.width, preset.height)}
                    disabled={savingKey !== null}
                    className={`
                      p-3 rounded-xl text-left transition-all duration-200 border
                      ${isActive
                        ? 'bg-accent-500/10 border-accent-500/50 text-accent-600 dark:text-accent-400'
                        : 'bg-surface-100/50 dark:bg-white/5 border-transparent hover:bg-surface-200/50 dark:hover:bg-white/10'
                      }
                    `}
                  >
                    <span className="font-medium text-sm">{preset.label}</span>
                    <p className="text-xs font-mono text-surface-500 mt-1">{resStr}</p>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <div className="flex flex-1 gap-2">
                <input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  placeholder={t('deviceTools.resolution.width')}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                />
                <span className="flex items-center text-surface-400">×</span>
                <input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  placeholder={t('deviceTools.resolution.height')}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                />
              </div>
              <Button
                variant="primary"
                onClick={() => changeResolution(parseInt(customWidth), parseInt(customHeight))}
                disabled={!customWidth || !customHeight || savingKey !== null}
                loading={savingKey === 'currentResolution'}
                className="sm:w-32"
              >
                {t('deviceTools.resolution.apply')}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetResolution}
              disabled={settings.currentResolution === settings.defaultResolution || savingKey !== null}
              loading={savingKey === 'resetRes'}
              icon={<RotateCcw className="w-4 h-4" />}
              className="w-full"
            >
              {t('deviceTools.resolution.reset', { value: settings.defaultResolution || '' })}
            </Button>
          </Card>
        </motion.div>

        {/* Font Scale */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="glass" className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Type className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold text-surface-900 dark:text-white">{t('deviceTools.fontScale.title')}</h2>
                <p className="text-xs text-surface-500">
                  {t('deviceTools.fontScale.current')}: <span className="font-mono font-semibold">{settings.fontScale}x</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FONT_SCALES.map((scale) => (
                <button
                  key={scale.value}
                  onClick={() => changeSetting(
                    'fontScale',
                    `settings put system font_scale ${scale.value}`,
                    scale.value,
                    t('deviceTools.fontScale.success', { value: scale.label })
                  )}
                  disabled={savingKey !== null}
                  className={`
                    p-3 rounded-xl text-center transition-all duration-200 border
                    ${settings.fontScale === scale.value
                      ? 'bg-accent-500/10 border-accent-500/50 text-accent-600 dark:text-accent-400'
                      : 'bg-surface-100/50 dark:bg-white/5 border-transparent hover:bg-surface-200/50 dark:hover:bg-white/10'
                    }
                  `}
                >
                  <span className="font-medium text-sm">{t(scale.label)}</span>
                  <p className="text-xs font-mono text-surface-500 mt-1">{scale.value}x</p>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Screen Timeout */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card variant="glass" className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold text-surface-900 dark:text-white">{t('deviceTools.timeout.title')}</h2>
                <p className="text-xs text-surface-500">
                  {t('deviceTools.timeout.subtitle')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TIMEOUT_PRESETS.map((timeout) => {
                let label = '';
                if (timeout.value === 2147483647) label = t('deviceTools.timeout.never');
                else if (timeout.value >= 60000) label = t('deviceTools.timeout.minutes', { value: timeout.value / 60000 });
                else label = t('deviceTools.timeout.seconds', { value: timeout.value / 1000 });

                return (
                  <button
                    key={timeout.value}
                    onClick={() => changeSetting(
                      'screenOffTimeout',
                      `settings put system screen_off_timeout ${timeout.value}`,
                      timeout.value,
                      t('deviceTools.timeout.success', { value: label })
                    )}
                    disabled={savingKey !== null}
                    className={`
                      p-2 rounded-xl text-center transition-all duration-200 border text-sm
                      ${settings.screenOffTimeout === timeout.value
                        ? 'bg-accent-500/10 border-accent-500/50 text-accent-600 dark:text-accent-400'
                        : 'bg-surface-100/50 dark:bg-white/5 border-transparent hover:bg-surface-200/50 dark:hover:bg-white/10'
                      }
                    `}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </Card>
        </motion.div>

        {/* Animations - Full Width */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card variant="glass" className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-pink-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-semibold text-surface-900 dark:text-white">{t('deviceTools.animations.title')}</h2>
                  <p className="text-xs text-surface-500">
                    {t('deviceTools.animations.subtitle')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={disableAllAnimations}
                  disabled={savingKey !== null}
                  loading={savingKey === 'allAnimations'}
                  icon={<Zap className="w-4 h-4" />}
                  className="flex-1 sm:flex-none"
                >
                  {t('deviceTools.animations.disableAll')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAllAnimations}
                  disabled={savingKey !== null}
                  icon={<RotateCcw className="w-4 h-4" />}
                  className="flex-1 sm:flex-none"
                >
                  {t('deviceTools.animations.reset')}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Window Animation */}
              <div>
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 block">
                  {t('deviceTools.animations.window')} ({settings.windowAnimationScale}x)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ANIMATION_SCALES.map((scale) => (
                    <button
                      key={scale.value}
                      onClick={() => changeAnimationScale('window', scale.value)}
                      disabled={savingKey !== null}
                      className={`
                        px-3 py-2 rounded-xl text-xs font-semibold transition-all border
                        ${settings.windowAnimationScale === scale.value
                          ? 'bg-accent-500 border-accent-500 text-white shadow-lg shadow-accent-500/25'
                          : 'bg-surface-100 dark:bg-white/5 border-transparent hover:bg-surface-200 dark:hover:bg-white/10 text-surface-600 dark:text-surface-400'
                        }
                      `}
                    >
                      {scale.value === 0 ? t('deviceTools.animations.labelOff') : scale.value === 1 ? t('deviceTools.animations.labelDefault') : scale.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transition Animation */}
              <div>
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 block">
                  {t('deviceTools.animations.transition')} ({settings.transitionAnimationScale}x)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ANIMATION_SCALES.map((scale) => (
                    <button
                      key={scale.value}
                      onClick={() => changeAnimationScale('transition', scale.value)}
                      disabled={savingKey !== null}
                      className={`
                        px-3 py-2 rounded-xl text-xs font-semibold transition-all border
                        ${settings.transitionAnimationScale === scale.value
                          ? 'bg-accent-500 border-accent-500 text-white shadow-lg shadow-accent-500/25'
                          : 'bg-surface-100 dark:bg-white/5 border-transparent hover:bg-surface-200 dark:hover:bg-white/10 text-surface-600 dark:text-surface-400'
                        }
                      `}
                    >
                      {scale.value === 0 ? t('deviceTools.animations.labelOff') : scale.value === 1 ? t('deviceTools.animations.labelDefault') : scale.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Animator Duration */}
              <div>
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 block">
                  {t('deviceTools.animations.animator')} ({settings.animatorDurationScale}x)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ANIMATION_SCALES.map((scale) => (
                    <button
                      key={scale.value}
                      onClick={() => changeAnimationScale('animator', scale.value)}
                      disabled={savingKey !== null}
                      className={`
                        px-3 py-2 rounded-xl text-xs font-semibold transition-all border
                        ${settings.animatorDurationScale === scale.value
                          ? 'bg-accent-500 border-accent-500 text-white shadow-lg shadow-accent-500/25'
                          : 'bg-surface-100 dark:bg-white/5 border-transparent hover:bg-surface-200 dark:hover:bg-white/10 text-surface-600 dark:text-surface-400'
                        }
                      `}
                    >
                      {scale.value === 0 ? t('deviceTools.animations.labelOff') : scale.value === 1 ? t('deviceTools.animations.labelDefault') : scale.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Quick Toggles - Full Width */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-2"
        >
          <Card variant="glass" className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-cyan-500" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold text-surface-900 dark:text-white">{t('deviceTools.developer.title')}</h2>
                <p className="text-xs text-surface-500">{t('deviceTools.developer.subtitle')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ToggleButton
                label={t('deviceTools.developer.showTouches')}
                description={t('deviceTools.developer.showTouchesDesc')}
                icon={<Vibrate className="w-4 h-4" />}
                isActive={settings.showTouches || false}
                isLoading={savingKey === 'showTouches'}
                onClick={() => changeSetting(
                  'showTouches',
                  `settings put system show_touches ${settings.showTouches ? 0 : 1}`,
                  !settings.showTouches,
                  settings.showTouches ? t('deviceTools.developer.touchesOff') : t('deviceTools.developer.touchesOn')
                )}
              />
              <ToggleButton
                label={t('deviceTools.developer.layoutBounds')}
                description={t('deviceTools.developer.layoutBoundsDesc')}
                icon={<Maximize2 className="w-4 h-4" />}
                isActive={settings.showLayoutBounds || false}
                isLoading={savingKey === 'showLayoutBounds'}
                onClick={() => changeSetting(
                  'showLayoutBounds',
                  `settings put system pointer_location ${settings.showLayoutBounds ? 0 : 1}`,
                  !settings.showLayoutBounds,
                  settings.showLayoutBounds ? t('deviceTools.developer.layoutOff') : t('deviceTools.developer.layoutOn')
                )}
              />
              <ToggleButton
                label={t('deviceTools.developer.stayAwake')}
                description={t('deviceTools.developer.stayAwakeDesc')}
                icon={<Battery className="w-4 h-4" />}
                isActive={settings.stayAwakeWhileCharging || false}
                isLoading={savingKey === 'stayAwakeWhileCharging'}
                onClick={() => changeSetting(
                  'stayAwakeWhileCharging',
                  `settings put global stay_on_while_plugged_in ${settings.stayAwakeWhileCharging ? 0 : 7}`,
                  !settings.stayAwakeWhileCharging,
                  settings.stayAwakeWhileCharging ? t('deviceTools.developer.awakeOff') : t('deviceTools.developer.awakeOn')
                )}
              />
              <ToggleButton
                label={t('deviceTools.developer.adaptiveBrightness')}
                description={t('deviceTools.developer.adaptiveBrightnessDesc')}
                icon={<Sun className="w-4 h-4" />}
                isActive={settings.adaptiveBrightness || false}
                isLoading={savingKey === 'adaptiveBrightness'}
                onClick={() => changeSetting(
                  'adaptiveBrightness',
                  `settings put system screen_brightness_mode ${settings.adaptiveBrightness ? 0 : 1}`,
                  !settings.adaptiveBrightness,
                  settings.adaptiveBrightness ? t('deviceTools.developer.brightnessManual') : t('deviceTools.developer.brightnessAuto')
                )}
              />
            </div>
          </Card>
        </motion.div>
      </div>
    </div >
  )
}

// Toggle Button Component
interface ToggleButtonProps {
  label: string
  description: string
  icon: React.ReactNode
  isActive: boolean
  isLoading: boolean
  onClick: () => void
}

function ToggleButton({ label, description, icon, isActive, isLoading, onClick }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        p-4 rounded-xl text-left transition-all duration-200 border h-full flex flex-col
        ${isActive
          ? 'bg-accent-500/10 border-accent-500/50'
          : 'bg-surface-100/50 dark:bg-white/5 border-transparent hover:bg-surface-200/50 dark:hover:bg-white/10'
        }
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`${isActive ? 'text-accent-500' : 'text-surface-500'}`}>
          {icon}
        </div>
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-accent-500" />
        ) : (
          <div className={`
            w-8 h-5 rounded-full transition-colors p-0.5
            ${isActive ? 'bg-accent-500' : 'bg-surface-300 dark:bg-surface-600'}
          `}>
            <div className={`
              w-4 h-4 rounded-full bg-white shadow transition-transform
              ${isActive ? 'translate-x-3' : 'translate-x-0'}
            `} />
          </div>
        )}
      </div>
      <p className={`font-medium text-sm ${isActive ? 'text-accent-600 dark:text-accent-400' : 'text-surface-900 dark:text-white'}`}>
        {label}
      </p>
      <p className="text-xs text-surface-500 mt-0.5">{description}</p>
    </button>
  )
}

