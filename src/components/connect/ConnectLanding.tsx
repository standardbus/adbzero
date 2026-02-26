import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useAnimationFrame, useMotionValue } from 'framer-motion'
import { Usb, Shield, ArrowRight, AlertCircle, Globe, PlayCircle } from 'lucide-react'
import { useAdb } from '@/hooks/useAdb'
import { useTranslation } from '@/stores/i18nStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ThreeDCoverflow } from '@/components/ui/ThreeDCoverflow'
import { createDefaultConnectHomeTemplate } from '@/lib/connect-template'
import { CONNECT_CAROUSEL_IMAGES } from '@/lib/connect-carousel-seo'
import type { ConnectHomeTemplate } from '@/types/cms'

interface ConnectLandingProps {
  mode: 'app' | 'cms'
  template?: ConnectHomeTemplate | null
}

export function ConnectLanding({ mode, template }: ConnectLandingProps) {
  const { connect, enterDemoMode, connectionStatus, connectionError } = useAdb()
  const [showInstructions, setShowInstructions] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [pendingAction, setPendingAction] = useState<'connect' | 'demo' | null>(null)
  const isMobile = useIsMobile()
  const { t, language, setLanguage, supportedLanguages, languageNames, languageFlags } = useTranslation()

  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'authorizing'
  const marqueeX = useMotionValue(0)
  const marqueeGap = isMobile ? 14 : 24
  const marqueeItemWidth = isMobile ? 232 : 500
  const marqueeItemHeight = isMobile ? 186 : 400
  const marqueeTotalWidth = CONNECT_CAROUSEL_IMAGES.length * (marqueeItemWidth + marqueeGap)
  const fallbackTemplate = useMemo(
    () => createDefaultConnectHomeTemplate((key, params) => t(key, params as Record<string, any>)),
    [t]
  )
  const content = template || fallbackTemplate
  const marqueeSlides = useMemo(
    () => [...CONNECT_CAROUSEL_IMAGES, ...CONNECT_CAROUSEL_IMAGES],
    []
  )

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null
    if (connectionStatus === 'authorizing') {
      timeout = setTimeout(() => {
        window.location.reload()
      }, 30000) // 30 seconds timeout
    }
    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [connectionStatus])

  useAnimationFrame((_, delta) => {
    if (isMobile) return

    // Foreground slides move faster than background coverflow for parallax depth.
    const moveAmount = delta * 0.09
    let nextX = marqueeX.get() - moveAmount
    if (nextX <= -marqueeTotalWidth) {
      nextX += marqueeTotalWidth
    }
    marqueeX.set(nextX)
  })

  const handleConnectClick = () => {
    setPendingAction('connect')
    setShowDisclaimer(true)
  }

  const handleDemoClick = () => {
    setPendingAction('demo')
    void enterDemoMode()
  }

  const handleAcceptDisclaimer = () => {
    setShowDisclaimer(false)
    if (pendingAction === 'connect') {
      void connect()
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden ${mode === 'cms' ? 'min-h-[calc(100vh-8rem)]' : 'min-h-screen'
      }`}>
      <ThreeDCoverflow />
      <div className="absolute inset-0 bg-gradient-to-b from-surface-50/40 via-transparent to-surface-50/40 dark:from-surface-950/40 dark:via-transparent dark:to-surface-950/40 pointer-events-none" />

      {mode === 'app' ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 sm:top-6 left-1/2 sm:left-auto sm:right-6 -translate-x-1/2 sm:translate-x-0 z-10"
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-100/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 backdrop-blur-md">
            <Globe className="w-4 h-4 text-surface-500" />
            <select
              value={language}
              onChange={(e) => void setLanguage(e.target.value as any)}
              className="bg-transparent text-sm font-medium text-surface-700 dark:text-surface-200 outline-none cursor-pointer pr-2"
            >
              {supportedLanguages.map((lang) => (
                <option key={lang} value={lang} className="bg-surface-100 dark:bg-surface-800">
                  {languageFlags[lang]} {languageNames[lang]}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12 relative z-10"
      >
        <motion.div
          initial={{ scale: 0.8, rotate: -5 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 mx-auto mb-8 rounded-[2rem] bg-white/90 dark:bg-surface-900/80 border border-surface-200 dark:border-white/10 flex items-center justify-center shadow-2xl shadow-accent-500/20 relative group p-2"
        >
          <img src="/adbzero_logo.webp" alt={t('common.appName')} className="w-full h-full object-cover rounded-[1.25rem] relative z-10" />
          <div className="absolute inset-0 bg-accent-500 blur-2xl opacity-10 group-hover:opacity-25 transition-opacity" />
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-bold text-surface-900 dark:text-white tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-surface-900 to-surface-500 dark:from-white dark:to-surface-500">
          {content.hero.title}
        </h1>

        <div className="space-y-4 max-w-2xl mx-auto">
          <p className="text-xl md:text-2xl font-medium text-surface-800 dark:text-surface-200 tracking-tight">
            {content.hero.subtitle}
          </p>
          <p className="text-lg text-surface-500 dark:text-surface-400 leading-relaxed italic">
            {content.hero.description}
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-3">
            {content.hero.badges.map((feature, i) => (
              <span key={`${feature}-${i}`} className="px-4 py-1.5 rounded-full bg-surface-100/50 dark:bg-surface-800/50 backdrop-blur-sm text-surface-600 dark:text-surface-300 text-sm font-medium border border-surface-200 dark:border-surface-700">
                {feature.trim()}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col items-center gap-6 mb-12">
        {mode === 'cms' ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="w-full max-w-2xl"
          >
            <div className="rounded-xl border border-amber-400/50 bg-amber-100/85 dark:bg-amber-900/25 px-4 py-3 text-amber-900 dark:text-amber-200 shadow-sm">
              <p className="text-sm font-semibold leading-relaxed text-center">
                {t('connect.debugOptionsNotice')}
              </p>
            </div>
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <motion.button
            onClick={handleConnectClick}
            disabled={isConnecting}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative group"
          >
            <div className="absolute -inset-4 bg-accent-500/20 rounded-full blur-2xl group-hover:bg-accent-500/30 transition-all duration-500 opacity-0 group-hover:opacity-100" />

            <motion.div
              animate={!isConnecting ? {
                scale: [1, 1.2, 1],
                opacity: [0.5, 0, 0.5]
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -inset-2 border-2 border-accent-500/30 rounded-full"
            />

            <motion.div
              animate={connectionStatus === 'authorizing' ? {
                backgroundColor: ['#f59e0b', '#d97706', '#f59e0b'],
                scale: [1, 1.02, 1],
                boxShadow: ['0 0 0 0 rgba(245, 158, 11, 0)', '0 0 20px 5px rgba(245, 158, 11, 0.5)', '0 0 0 0 rgba(245, 158, 11, 0)']
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`
              relative flex items-center gap-4 px-10 py-5 rounded-full
              ${connectionStatus === 'authorizing'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gradient-to-r from-accent-600 to-accent-500 text-white shadow-accent-600/40'
                }
              font-semibold text-lg
              shadow-2xl
              transition-all duration-300
              ${isConnecting ? 'cursor-wait' : 'cursor-pointer'}
            `}
            >
              {isConnecting ? (
                connectionStatus === 'authorizing' ? (
                  <>
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.7, 1]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Shield className="w-6 h-6" strokeWidth={1.5} />
                    </motion.div>
                    <span className="animate-pulse">{t('connect.waitingForAuth')}</span>
                  </>
                ) : (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Usb className="w-6 h-6" strokeWidth={1.5} />
                    </motion.div>
                    <span>{t('connect.connecting')}</span>
                  </>
                )
              ) : (
                <>
                  <Usb className="w-6 h-6" strokeWidth={1.5} />
                  <span>{content.cta.connectLabel}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                </>
              )}
            </motion.div>
          </motion.button>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={handleDemoClick}
          className="flex items-center gap-2 px-6 py-3 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 hover:text-accent-500 transition-all group"
        >
          <PlayCircle className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
          <span className="text-sm font-medium">{content.cta.demoLabel}</span>
        </motion.button>

      </div>

      {connectionError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 max-w-lg w-full"
        >
          <div className="glass-card p-5 border border-red-500/30 bg-red-500/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                  {t('connect.connectionError')}
                </p>
                <div className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-line">
                  {connectionError.split('\n').map((line, i) => {
                    if (line.startsWith('adb ')) {
                      return (
                        <code key={i} className="block my-2 px-3 py-2 bg-surface-900 dark:bg-black/50 text-emerald-400 rounded-lg font-mono text-xs">
                          {line}
                        </code>
                      )
                    }
                    return <span key={i}>{line}<br /></span>
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={() => setShowInstructions(!showInstructions)}
        className="text-sm text-accent-500 hover:text-accent-400 transition-colors mb-12"
      >
        {showInstructions ? content.instructions.toggleHideLabel : content.instructions.toggleShowLabel}
      </motion.button>

      {showInstructions && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="max-w-lg mb-12"
        >
          <div className="glass-card p-6">
            <h3 className="font-semibold text-surface-900 dark:text-white mb-4">
              {content.instructions.title}
            </h3>
            <ol className="space-y-3 text-sm text-surface-600 dark:text-surface-400">
              {content.instructions.steps.map((step, index) => (
                <li className="flex gap-3" key={`${step}-${index}`}>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-500/10 text-accent-500 flex items-center justify-center text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </motion.div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="w-full max-w-[1080px] relative z-10"
      >
        <div className="connect-marquee-shell">
          <motion.div
            style={{ x: isMobile ? 0 : marqueeX, gap: `${marqueeGap}px` }}
            animate={isMobile ? { x: [-marqueeTotalWidth, 0] } : {}}
            transition={isMobile ? {
              duration: 12,
              repeat: Infinity,
              ease: 'linear'
            } : {}}
            className="connect-marquee-track"
          >
            {marqueeSlides.map((slide, index) => {

              return (
                <figure
                  key={`${slide.id}-${index}`}
                  className="connect-marquee-item"
                  style={{
                    width: `${marqueeItemWidth}px`,
                    height: `${marqueeItemHeight}px`
                  }}
                  itemScope
                  itemType="https://schema.org/ImageObject"
                  data-tags={slide.seoTags.join(',')}
                >
                  <img
                    src={slide.src}
                    alt={slide.seoDescription}
                    title={slide.seoTitle}
                    width={slide.width}
                    height={slide.height}
                    loading={index < 2 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    className="block w-full h-full object-cover"
                    itemProp="contentUrl"
                  />
                  <meta itemProp="name" content={slide.seoTitle} />
                  <meta itemProp="description" content={slide.seoDescription} />
                  <meta itemProp="keywords" content={slide.seoTags.join(', ')} />
                  <figcaption className="sr-only">{slide.seoDescription}</figcaption>
                </figure>
              )
            })}
          </motion.div>
        </div>
      </motion.section>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-12 text-xs text-surface-400 text-center"
      >
        {content.footerNotices.browserNotice} <br /><br /> {content.footerNotices.legalNotice}
      </motion.p>

      <AnimatePresence>
        {showDisclaimer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDisclaimer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-surface-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl">
                    <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-surface-900 dark:text-white">
                    {content.disclaimerModal.title}
                  </h3>
                </div>

                <div className="space-y-4 text-surface-600 dark:text-surface-400">
                  {content.disclaimerModal.body.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                <div className="mt-10 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAcceptDisclaimer}
                    className="flex-1 px-8 py-4 bg-accent-600 hover:bg-accent-700 text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-accent-600/20"
                  >
                    {content.disclaimerModal.acceptLabel}
                  </button>
                  <button
                    onClick={() => setShowDisclaimer(false)}
                    className="px-8 py-4 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-semibold rounded-2xl transition-colors"
                  >
                    {content.disclaimerModal.cancelLabel}
                  </button>
                </div>
              </div>

              <div className="px-8 py-4 bg-surface-50 dark:bg-surface-800/50 border-t border-surface-100 dark:border-surface-800">
                <p className="text-xs text-surface-500 text-center leading-relaxed">
                  {content.footerNotices.legalNotice}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
