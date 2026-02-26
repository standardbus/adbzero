/**
 * Dashboard Page
 * Shows device info with image and quick actions
 */

import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Battery,
  Cpu,
  MonitorSmartphone,
  Package,
  RefreshCw,
  ArrowRight,
  Zap,
  Shield,
  Leaf,
  Monitor,
  ScreenShare
} from 'lucide-react'
import { useAdb } from '@/hooks/useAdb'
import { useAppStore, type Page } from '@/stores/appStore'
import { Card, CardHeader } from '@/components/ui/Card'
import { useTranslation } from '@/stores/i18nStore'
import { SyncUpdateModal } from '@/components/sync/SyncUpdateModal'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function DashboardPage() {
  const { deviceInfo, loadPackages, packages } = useAdb()
  const setCurrentPage = useAppStore((state) => state.setCurrentPage)
  const { t } = useTranslation()

  useEffect(() => {
    // Load packages on mount for the package count
    loadPackages()
  }, [loadPackages])

  if (!deviceInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw className="w-8 h-8 text-accent-500" strokeWidth={1.5} />
        </motion.div>
      </div>
    )
  }

  const { isLandscape, isTablet } = useMemo(() => {
    const res = deviceInfo?.screenResolution || '1080x2400'
    const parts = res.toLowerCase().split('x').map(Number)
    const w = parts[0] || 1080
    const h = parts[1] || 2400
    const dpi = deviceInfo?.screenDensity ? parseInt(deviceInfo.screenDensity) : 420
    const swDp = Math.min(w, h) / (dpi / 160)
    return {
      isLandscape: w > h,
      isTablet: swDp >= 600
    }
  }, [deviceInfo.screenResolution, deviceInfo.screenDensity])

  const { mWidth, mHeight } = useMemo(() => {
    const res = deviceInfo?.screenResolution || '1080x2400'
    const parts = res.toLowerCase().split('x').map(Number)
    const w = parts[0] || 1080
    const h = parts[1] || 2400
    const ratio = h / w

    const maxWidth = 300
    const maxHeight = 380

    let width, height
    if (Math.abs(h) > Math.abs(w)) {
      // Portrait leaning
      height = maxHeight
      width = maxHeight / ratio
      if (width > maxWidth) {
        width = maxWidth
        height = maxWidth * ratio
      }
    } else {
      // Landscape leaning
      width = maxWidth
      height = maxWidth * ratio
      if (height > maxHeight) {
        height = maxHeight
        width = maxHeight / ratio
      }
    }
    return { mWidth: Math.abs(width), mHeight: Math.abs(height) }
  }, [deviceInfo.screenResolution])

  const quickActions: {
    title: string
    description: string
    icon: typeof Package
    page: Page
    color: string
    bgColor: string
  }[] = [
      {
        title: t('nav.debloater'),
        description: `${packages.length} ${t('dashboard.debloaterDesc')}`,
        icon: Package,
        page: 'debloater',
        color: 'text-accent-500',
        bgColor: 'bg-accent-500/10'
      },
      {
        title: t('nav.degoogle'),
        description: t('dashboard.degoogleDesc'),
        icon: Leaf,
        page: 'degoogle',
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10'
      },
      {
        title: t('nav.screenMirror'),
        description: t('dashboard.screenMirrorDesc'),
        icon: ScreenShare,
        page: 'screen-mirror',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10'
      },
      {
        title: t('nav.deviceTools'),
        description: t('dashboard.deviceToolsDesc'),
        icon: Monitor,
        page: 'device-tools',
        color: 'text-violet-500',
        bgColor: 'bg-violet-500/10'
      },
      {
        title: t('nav.privacy'),
        description: t('dashboard.privacyToolsDesc'),
        icon: Shield,
        page: 'privacy',
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10'
      },
      {
        title: t('nav.rootTools'),
        description: t('dashboard.rootToolsDesc'),
        icon: Zap,
        page: 'root-tools',
        color: 'text-red-500',
        bgColor: 'bg-red-500/10'
      }
    ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto terminal-spacer">
      <SyncUpdateModal />
      {/* Hero Section - Device Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="rounded-2xl bg-white/5 dark:bg-[#121214] backdrop-blur-xl border border-surface-200/50 dark:border-white/5 overflow-hidden shadow-2xl shadow-accent-500/10 hover:shadow-accent-500/20 transition-shadow duration-500 flex flex-col md:flex-row min-h-[460px] relative">
          {/* External Glow Layer */}
          <div className="absolute inset-0 -z-10 bg-accent-500/5 blur-[100px] rounded-full" />
          {/* Left Column - Phone Mockup Area */}
          <div className="w-full md:w-[320px] lg:w-[380px] bg-[#0f172a] relative flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
            {/* Background Radial Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-transparent to-transparent opacity-60" />

            {/* Phone/Tablet Mockup Design - Frameless & Dynamic Ratio */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', damping: 25 }}
              style={{ width: mWidth, height: mHeight }}
              className={`relative z-10 bg-[#f4f4f5] dark:bg-[#1a1a1c] border-2 border-surface-300 dark:border-[#333336] shadow-elevated-lg flex flex-col overflow-hidden transition-all duration-500 ${isTablet ? 'rounded-[1.5rem]' : 'rounded-[2.5rem]'}`}
            >
              {/* Inner Screen Container */}
              <div className={`flex-1 m-1 relative flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-500 ${isTablet ? 'rounded-[1.3rem]' : 'rounded-[2.3rem]'}`}>
                {/* Rainbow Animated Background */}
                <motion.div
                  animate={{
                    filter: ["hue-rotate(0deg)", "hue-rotate(360deg)"],
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="absolute inset-0 bg-gradient-to-br from-[#4f46e5] via-[#8b5cf6] to-[#ec4899] z-0"
                />

                {/* Content Layer */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-6">
                  {/* Selfie Camera - Adaptive placement */}
                  <div className={`absolute w-2 h-2 rounded-full bg-black/60 backdrop-blur-md ${isLandscape && isTablet ? 'top-1/2 left-4 -translate-y-1/2' : 'top-4 left-1/2 -translate-x-1/2'}`} />

                  <span className={`font-black text-white/10 select-none transition-all duration-500 ${isTablet ? 'text-9xl' : 'text-8xl'}`}>
                    {isTablet ? 'T' : 'S'}
                  </span>
                  <p className="mt-8 text-[10px] font-bold text-white/50 tracking-widest uppercase truncate max-w-full px-4">{deviceInfo.model}</p>

                  {/* Subtle Screen Shine */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none" />

                  {/* Modern Navigation Pill */}
                  <div className={`absolute rounded-full bg-white/20 transition-all duration-500 ${isLandscape && isTablet ? 'bottom-1/2 right-4 translate-y-1/2 w-1 h-12' : 'bottom-4 left-1/2 -translate-x-1/2 w-12 h-1'}`} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Device Details */}
          <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center">
            <div className="mb-10">
              <span className="text-xs font-black text-accent-500 dark:text-[#4f46e5] uppercase tracking-[0.3em] mb-3 block">
                {deviceInfo.manufacturer}
              </span>
              <h1 className="text-4xl md:text-[3.5rem] font-bold text-surface-900 dark:text-white tracking-tight leading-none">
                {deviceInfo.model}
              </h1>
            </div>

            {/* Stats Grid - Exactly like the image */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12">
              {/* Android Stat */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                    <Cpu className="w-5 h-5 text-emerald-500" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-black text-surface-400 dark:text-surface-500 uppercase tracking-widest">
                    {t('dashboard.android')}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-bold text-surface-900 dark:text-white">
                    {deviceInfo.androidVersion} (API {deviceInfo.apiLevel})
                  </p>
                </div>
              </div>

              {/* Battery Stat */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${deviceInfo.batteryLevel > 20 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <Battery className={`w-5 h-5 ${deviceInfo.batteryLevel > 20 ? 'text-emerald-500' : 'text-red-500'}`} strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-black text-surface-400 dark:text-surface-500 uppercase tracking-widest">
                    {t('dashboard.battery')}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-bold text-surface-900 dark:text-white">
                    {deviceInfo.batteryLevel}%
                  </p>
                  <p className="text-xs font-bold text-surface-400 dark:text-surface-500 mt-1 uppercase tracking-tight opacity-70">
                    {deviceInfo.batteryStatus}
                  </p>
                </div>
              </div>

              {/* Screen Stat */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shadow-inner">
                    <MonitorSmartphone className="w-5 h-5 text-violet-500" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-black text-surface-400 dark:text-surface-500 uppercase tracking-widest">
                    {t('dashboard.screen')}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-bold text-surface-900 dark:text-white">
                    {deviceInfo.screenResolution}
                  </p>
                  <p className="text-xs font-bold text-surface-400 dark:text-surface-500 mt-1 uppercase tracking-tight opacity-70">
                    {deviceInfo.screenDensity} DPI
                  </p>
                </div>
              </div>
            </div>

            <div className="h-px bg-white/5 w-full mb-10" />

            {/* Serial Number Row - Pill Style */}
            <div className="flex">
              <div className="bg-surface-100 dark:bg-white/5 border border-white/5 rounded-2xl px-5 py-3 flex items-center gap-4 group hover:border-accent-500/30 transition-colors">
                <span className="text-[10px] font-black text-surface-400 dark:text-surface-500 uppercase tracking-[0.2em]">
                  {t('dashboard.serialNumber')}
                </span>
                <code className="text-sm font-bold text-accent-500 dark:text-[#4f46e5] tracking-widest font-mono">
                  {deviceInfo.serialNumber}
                </code>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
      >
        <h2 className="text-xl font-semibold text-surface-900 dark:text-white tracking-tight mb-4">
          {t('dashboard.quickActions')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <motion.div
                key={action.title}
                variants={item}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  variant="glass"
                  padding="md"
                  hoverable
                  onClick={() => setCurrentPage(action.page)}
                  className="cursor-pointer group h-full"
                >
                  <div className="flex flex-col h-full">
                    <div className={`p-3 rounded-xl ${action.bgColor} w-fit mb-3`}>
                      <Icon className={`w-5 h-5 ${action.color}`} strokeWidth={1.5} />
                    </div>
                    <h3 className="font-semibold text-surface-900 dark:text-white mb-1 group-hover:text-accent-500 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-sm text-surface-500 flex-1">
                      {action.description}
                    </p>
                    <ArrowRight
                      className="w-4 h-4 text-surface-400 group-hover:text-accent-500 group-hover:translate-x-1 transition-all mt-3"
                      strokeWidth={1.5}
                    />
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Device Details Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <Card variant="default" padding="lg">
          <CardHeader
            title={t('dashboard.technicalSpecs')}
            subtitle={t('dashboard.completeDeviceInfo')}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 lg:gap-x-8 gap-y-0">
            <DetailRow label={t('dashboard.manufacturer')} value={deviceInfo.manufacturer} />
            <DetailRow label={t('dashboard.model')} value={deviceInfo.model} />
            <DetailRow label={t('dashboard.androidVersion')} value={deviceInfo.androidVersion} />
            <DetailRow label={t('dashboard.apiLevel')} value={deviceInfo.apiLevel} />
            <DetailRow label={t('dashboard.serialNumber')} value={deviceInfo.serialNumber} />
            <DetailRow label={t('dashboard.resolution')} value={deviceInfo.screenResolution} />
            <DetailRow label={t('dashboard.screenDensity')} value={`${deviceInfo.screenDensity} DPI`} />
            <DetailRow label={t('dashboard.battery')} value={`${deviceInfo.batteryLevel}% (${deviceInfo.batteryStatus})`} />
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-200/50 dark:border-white/5 last:border-0">
      <span className="text-sm text-surface-500">{label}</span>
      <span className="text-sm font-medium text-surface-900 dark:text-white font-mono">{value}</span>
    </div >
  )
}
