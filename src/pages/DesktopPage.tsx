/**
 * Desktop Mode Page
 * Creates a virtual Android display (API 33+) via scrcpy newDisplay,
 * adapting resolution dynamically to the browser container.
 * 
 * ADAPTIVE QUALITY: Starts at maximum quality and auto-downgrades
 * when sustained frame drops are detected.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Monitor,
  Play,
  Square,
  Maximize2,
  Loader2,
  AlertTriangle,
  Info,
  Zap,
  Video,
  Circle,
  Webcam
} from 'lucide-react'
import { WebcamOverlay } from '@/components/mirror/WebcamOverlay'
import { AndroidScreenPowerMode } from '@yume-chan/scrcpy'
import { Button } from '@/components/ui/Button'
import { useAdb } from '@/hooks/useAdb'
import { getAdb, shell } from '@/services/adb-client'
import { useAppStore } from '@/stores/appStore'
import { useAdbStore } from '@/stores/adbStore'
import { useTranslation } from '@/stores/i18nStore'
import {
  ScrcpySession,
  QUALITY_PRESETS,
  getDefaultPreset,
  type QualityPreset
} from '@/services/scrcpy-client'
import { useScreenRecorder } from '@/hooks/useScreenRecorder'
import { ControlSheet } from '@/components/mirror/ControlSheet'

const RESIZE_DEBOUNCE_MS = 500
const RESIZE_THRESHOLD_PX = 50
const TRANSITION_BITRATE = 2_000_000
const BASE_DPI = 160
const DPI_REFERENCE_SIZE = 1080
const MIN_DPI = 120

function calculateDisplayParams(container: HTMLElement) {
  const rect = container.getBoundingClientRect()
  // Round to even numbers
  const width = Math.max(2, Math.round(rect.width / 2) * 2)
  const height = Math.max(2, Math.round(rect.height / 2) * 2)
  const smallerDim = Math.min(width, height)
  const dpi = Math.max(MIN_DPI, Math.round(BASE_DPI * smallerDim / DPI_REFERENCE_SIZE))
  return { width, height, dpi }
}

export function DesktopPage() {
  const { isConnected } = useAdb()
  const { showToast } = useAppStore()
  const deviceInfo = useAdbStore((state) => state.deviceInfo)
  const { t } = useTranslation()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const displayContainerRef = useRef<HTMLDivElement>(null)
  const scrcpyRef = useRef<ScrcpySession | null>(null)

  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isScreenOff, setIsScreenOff] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [currentFps, setCurrentFps] = useState(0)
  const [currentPreset, setCurrentPreset] = useState<string>(getDefaultPreset().name)
  const [isAdapting, setIsAdapting] = useState(false)
  const [isAdaptiveEnabled, setIsAdaptiveEnabled] = useState(false) // Default: Manual/Ultra
  const isAdaptiveEnabledRef = useRef(false)
  const [isWebcamVisible, setIsWebcamVisible] = useState(false)

  useEffect(() => {
    isAdaptiveEnabledRef.current = isAdaptiveEnabled
  }, [isAdaptiveEnabled])

  const { isRecording, formatDuration, startRecording, stopRecording } = useScreenRecorder()

  // New state to restart session
  const [restartParams, setRestartParams] = useState<{ presetName: string, bitRate: number, maxFps: number } | null>(null)

  // Track last display size
  const lastDisplaySize = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const resizeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isRestartingRef = useRef(false)
  const isAdaptingRef = useRef(false)

  // Webcam refs
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null)
  const webcamContainerRef = useRef<HTMLDivElement | null>(null)
  const [webcamShape, setWebcamShape] = useState<'rect' | 'circle' | 'square' | 'video'>('rect')
  const webcamShapeRef = useRef<'rect' | 'circle' | 'square' | 'video'>('rect')

  useEffect(() => {
    webcamShapeRef.current = webcamShape
  }, [webcamShape])

  const drawOverlay = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!isWebcamVisible || !webcamVideoRef.current || !webcamContainerRef.current) return
    const container = displayContainerRef.current
    if (!container) return

    // Relative to displayContainer (which holds the canvas)
    const containerRect = container.getBoundingClientRect()
    const webcamRect = webcamContainerRef.current.getBoundingClientRect()

    const relX = (webcamRect.left - containerRect.left) / containerRect.width
    const relY = (webcamRect.top - containerRect.top) / containerRect.height
    const relW = webcamRect.width / containerRect.width
    const relH = webcamRect.height / containerRect.height

    const canvasW = ctx.canvas.width
    const canvasH = ctx.canvas.height

    const x = relX * canvasW
    const y = relY * canvasH
    const w = relW * canvasW
    const h = relH * canvasH

    // 4. Draw
    ctx.save()

    // Draw Overlay Label (adbzero.com) if enabled
    if (true) {
      ctx.save()
      ctx.font = 'bold 16px Inter, sans-serif'
      ctx.fillStyle = 'white'
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 4
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText('adbzero.com', canvasW - 20, 20)
      ctx.restore()
    }

    if (webcamVideoRef.current && webcamContainerRef.current) {
      ctx.beginPath()

      switch (webcamShapeRef.current) {
        case 'circle':
          // For circle, we use the smallest dimension to keep it circular, centered in rect
          const size = Math.min(w, h)
          const cx = x + w / 2
          const cy = y + h / 2
          ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
          break
        case 'square':
          // Force square aspect
          const sqSize = Math.min(w, h)
          const sqX = x + (w - sqSize) / 2
          const sqY = y + (h - sqSize) / 2
          ctx.rect(sqX, sqY, sqSize, sqSize)
          break
        case 'video':
          ctx.rect(x, y, w, h)
          break
        default: // rect (rounded)
          const radius = 16 * (canvasW / containerRect.width)
          ctx.roundRect(x, y, w, h, radius)
          break
      }

      ctx.clip()

      // Adjust draw parameters based on shape constraints (centering)
      if (webcamShapeRef.current === 'circle' || webcamShapeRef.current === 'square') {
        const size = Math.min(w, h)
        const dx = x + (w - size) / 2
        const dy = y + (h - size) / 2
        ctx.drawImage(webcamVideoRef.current, dx, dy, size, size)
      } else {
        ctx.drawImage(webcamVideoRef.current, x, y, w, h)
      }
    }

    ctx.restore()
  }, [isWebcamVisible, webcamVideoRef, webcamContainerRef, displayContainerRef]) // Removed webcamShapeRef from dependencies

  useEffect(() => {
    if (scrcpyRef.current) {
      scrcpyRef.current.setOverlayDrawer(isWebcamVisible ? drawOverlay : null)
    }
  }, [isWebcamVisible, drawOverlay])

  // Optimize refs callbacks
  const setWebcamVideoRef = useCallback((el: HTMLVideoElement | null) => {
    webcamVideoRef.current = el
  }, [])

  const setWebcamContainerRef = useCallback((el: HTMLDivElement | null) => {
    webcamContainerRef.current = el
  }, [])

  const apiLevel = deviceInfo?.apiLevel ? parseInt(deviceInfo.apiLevel) : 0

  const sendDesktopSettings = async () => {
    try {
      await shell('settings put global force_resizable_activities 1')
      await shell('settings put global enable_freeform_support 1')
      await shell('settings put global force_desktop_mode_on_external_displays 1')
      console.log('[Desktop] Settings applied')
    } catch (err) {
      console.warn('[Desktop] Failed to apply settings:', err)
    }
  }

  const stopDesktopSession = useCallback(async () => {
    if (scrcpyRef.current) {
      scrcpyRef.current.stop()
      scrcpyRef.current = null
    }
    setIsActive(false)
    setCurrentFps(0)
    setCurrentFps(0)
    // Don't reset preset, keep user selection
  }, [])

  // Defined BEFORE startDesktopSession
  const handleQualityDowngrade = useCallback(async (
    currentPresetName: string,
    suggestedPreset: QualityPreset | null
  ) => {
    if (!isAdaptiveEnabledRef.current || isAdaptingRef.current || isRestartingRef.current) return
    if (!suggestedPreset) {
      showToast({
        type: 'warning',
        title: t('screenMirror.adaptiveMinReached') || 'Already at minimum quality',
        message: t('screenMirror.adaptiveMinReachedDesc') || 'Stream is at lowest quality tier.'
      })
      return
    }

    isAdaptingRef.current = true
    setIsAdapting(true)

    console.log(`[Desktop] Auto-downgrading: ${currentPresetName} -> ${suggestedPreset.name}`)

    showToast({
      type: 'warning',
      title: t('screenMirror.adaptiveDowngrade') || 'Quality adjusted',
      message: `${t('screenMirror.adaptiveDowngradeDesc') || 'Lowered to'} ${suggestedPreset.name.toUpperCase()}`
    })

    // Stop current session
    if (scrcpyRef.current) {
      scrcpyRef.current.stop()
      scrcpyRef.current = null
    }
    setIsActive(false)

    // Trigger restart via state/effect
    setRestartParams({
      presetName: suggestedPreset.name,
      bitRate: suggestedPreset.bitRate,
      maxFps: suggestedPreset.maxFps
    })
  }, [showToast, t])

  const startDesktopSession = useCallback(async (bitRate?: number, maxFps?: number, presetName?: string) => {
    if (scrcpyRef.current) return
    if (!displayContainerRef.current || !canvasRef.current) return

    setIsLoading(true)
    setError(null)

    setError(null)

    const preset = presetName || currentPreset || getDefaultPreset().name
    const defaultPreset = getDefaultPreset()

    try {
      const adb = getAdb()
      if (!adb) throw new Error('Device not connected')

      await sendDesktopSettings()

      const session = new ScrcpySession(adb, {
        onQualityDegraded: handleQualityDowngrade,
        onFpsUpdate: setCurrentFps
      })
      scrcpyRef.current = session

      session.setClipboardCallback((text) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text)
            .then(() => showToast({ type: 'info', title: 'Clipboard copied' }))
            .catch((e) => console.warn('Clipboard write failed', e))
        }
      })

      const { width, height, dpi } = calculateDisplayParams(displayContainerRef.current)
      lastDisplaySize.current = { width, height }

      const useBitRate = bitRate || defaultPreset.bitRate
      const useMaxFps = maxFps || defaultPreset.maxFps

      console.log(`[Desktop] Starting with ${width}x${height}/${dpi} @ ${(useBitRate / 1_000_000).toFixed(1)}Mbps | Preset: ${preset}`)

      await session.startDesktop(canvasRef.current, {
        width,
        height,
        dpi,
        bitRate: useBitRate,
        maxFps: useMaxFps,
        presetName: preset,
      })

      setCurrentPreset(preset)
      setIsActive(true)
      showToast({ type: 'success', title: t('desktopMode.started') })
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      showToast({ type: 'error', title: t('toast.error'), message: err.message })
      stopDesktopSession()
    } finally {
      setIsLoading(false)
    }
  }, [handleQualityDowngrade, showToast, t, stopDesktopSession, currentPreset])

  const handleManualQualitySelect = useCallback(async (presetName: string) => {
    setIsAdaptiveEnabled(false)
    if (isActive) {
      if (currentPreset === presetName) {
        showToast({ type: 'info', title: t('screenMirror.adaptiveDisabled') || 'Adaptive quality disabled' })
        return
      }

      showToast({ type: 'info', title: `${t('screenMirror.switchingTo') || 'Switching to'} ${presetName.toUpperCase()}...` })

      if (scrcpyRef.current) {
        scrcpyRef.current.stop()
        scrcpyRef.current = null
      }
      setIsActive(false)

      // Use lower bitrate/transition? No, switch to target preset directly
      const target = QUALITY_PRESETS.find(p => p.name === presetName)

      setTimeout(() => {
        startDesktopSession(target?.bitRate, target?.maxFps, presetName)
      }, 100)
    } else {
      setCurrentPreset(presetName)
    }
  }, [isActive, currentPreset, showToast, startDesktopSession, t])

  // Effect for adaptive restart
  useEffect(() => {
    if (restartParams) {
      const timer = setTimeout(() => {
        startDesktopSession(restartParams.bitRate, restartParams.maxFps, restartParams.presetName)
          .then(() => {
            setRestartParams(null)
            isAdaptingRef.current = false
            setIsAdapting(false)
          })
          .catch(e => {
            console.error("Restart failed", e)
            setRestartParams(null)
            isAdaptingRef.current = false
            setIsAdapting(false)
          })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [restartParams, startDesktopSession])

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrcpyRef.current) {
        scrcpyRef.current.stop()
      }
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
    }
  }, [])


  const restartWithNewSize = useCallback(async () => {
    if (isRestartingRef.current || isAdaptingRef.current) return
    isRestartingRef.current = true
    setIsResizing(true)

    try {
      if (scrcpyRef.current) {
        scrcpyRef.current.stop()
        scrcpyRef.current = null
      }
      setIsActive(false)

      await new Promise(r => setTimeout(r, 200))

      // Restart with lower bitrate during transition
      await startDesktopSession(TRANSITION_BITRATE, undefined, currentPreset)

      setTimeout(() => {
        setIsResizing(false)
      }, 1000)
    } catch (err) {
      console.error('[Desktop] Restart failed:', err)
      setIsResizing(false)
    } finally {
      isRestartingRef.current = false
    }
  }, [startDesktopSession, currentPreset])

  useEffect(() => {
    const container = displayContainerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      if (!scrcpyRef.current || !scrcpyRef.current.isActive) return

      const { width, height } = calculateDisplayParams(container)
      const deltaW = Math.abs(width - lastDisplaySize.current.width)
      const deltaH = Math.abs(height - lastDisplaySize.current.height)

      if (deltaW > RESIZE_THRESHOLD_PX || deltaH > RESIZE_THRESHOLD_PX) {
        if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
        resizeTimerRef.current = setTimeout(() => {
          restartWithNewSize()
        }, RESIZE_DEBOUNCE_MS)
      }
    })

    observer.observe(container)
    return () => {
      observer.disconnect()
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
    }
  }, [restartWithNewSize])


  const toggleScreenPower = async () => {
    if (!scrcpyRef.current) return
    const newMode = !isScreenOff ? AndroidScreenPowerMode.Off : AndroidScreenPowerMode.Normal
    await scrcpyRef.current.setScreenPowerMode(newMode)
    setIsScreenOff(!isScreenOff)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const getNormalizedCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const elementWidth = rect.width
    const elementHeight = rect.height
    const videoWidth = canvas.width
    const videoHeight = canvas.height

    if (!elementWidth || !elementHeight || !videoWidth || !videoHeight) return null

    const elementRatio = elementWidth / elementHeight
    const videoRatio = videoWidth / videoHeight

    let drawnWidth = elementWidth
    let drawnHeight = elementHeight
    let offsetX = 0
    let offsetY = 0

    if (elementRatio > videoRatio) {
      drawnWidth = elementHeight * videoRatio
      offsetX = (elementWidth - drawnWidth) / 2
    } else {
      drawnHeight = elementWidth / videoRatio
      offsetY = (elementHeight - drawnHeight) / 2
    }

    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top

    if (clientX < offsetX || clientX > offsetX + drawnWidth ||
      clientY < offsetY || clientY > offsetY + drawnHeight) {
      return null
    }

    const x = (clientX - offsetX) / drawnWidth
    const y = (clientY - offsetY) / drawnHeight

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    }
  }

  const handlePointerDown = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive || !scrcpyRef.current || !canvasRef.current) return
    e.preventDefault()
    canvasRef.current.setPointerCapture(e.pointerId)
    const coords = getNormalizedCoordinates(e)
    if (coords) {
      await scrcpyRef.current.sendTouch('down', coords.x, coords.y)
    }
  }

  const handlePointerMove = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive || !scrcpyRef.current || !canvasRef.current) return
    e.preventDefault()
    if (e.buttons === 0) return
    const coords = getNormalizedCoordinates(e)
    if (coords) {
      await scrcpyRef.current.sendTouch('move', coords.x, coords.y)
    }
  }

  const handlePointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive || !scrcpyRef.current || !canvasRef.current) return
    e.preventDefault()
    canvasRef.current.releasePointerCapture(e.pointerId)
    const coords = getNormalizedCoordinates(e)
    if (coords) {
      await scrcpyRef.current.sendTouch('up', coords.x, coords.y)
    } else {
      await scrcpyRef.current.sendTouch('up', 0, 0)
    }
  }

  const handleScreenshot = async () => {
    if (!canvasRef.current) return
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `desktop_${Date.now()}.png`
        link.click()
        URL.revokeObjectURL(url)
      }
    }, 'image/png')
  }

  if (apiLevel > 0 && apiLevel < 33) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 mx-auto text-amber-500 mb-4" strokeWidth={1} />
          <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">
            {t('desktopMode.unsupported')}
          </h2>
          <p className="text-surface-500">
            {t('desktopMode.unsupportedDesc')}
          </p>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Monitor className="w-16 h-16 mx-auto text-surface-400 mb-4" strokeWidth={1} />
          <p className="text-surface-500">{t('desktopMode.connect')}</p>
        </div>
      </div>
    )
  }

  const activePresetInfo = QUALITY_PRESETS.find(p => p.name === currentPreset) || QUALITY_PRESETS[0]
  console.log('[Desktop] Active preset:', activePresetInfo.name)

  return (
    <div
      className={`flex-1 h-full flex flex-col transition-all duration-300 relative overflow-hidden ${isFullscreen ? 'bg-black p-0' : 'p-0 pb-10'
        }`}
      ref={containerRef}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{
          opacity: isFullscreen ? 0 : 1,
          y: isFullscreen ? -100 : 0
        }}
        transition={{ duration: 0.3 }}
        className={`
            flex items-center justify-between flex-wrap gap-4 z-50
            ${isFullscreen ? 'fixed top-0 left-0 right-0 pointer-events-none' : 'mb-4 pt-4 px-4'}
        `}
      >
        <div className="flex items-center justify-between flex-wrap gap-4 w-full">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">
                {t('desktopMode.title')}
              </h1>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] text-amber-500 uppercase font-black tracking-widest">
                Experimental
              </span>
            </div>
            <p className="text-sm text-surface-500">{t('desktopMode.subtitle')}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isResizing && (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('desktopMode.resizing')}
              </span>
            )}

            {isActive && (
              <div className="flex items-center gap-2">
                <div className={`
                    flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold
                    ${currentFps >= 30
                    ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400'
                    : currentFps >= 15
                      ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400'
                      : 'bg-red-500/15 text-red-500 dark:text-red-400'
                  }
                  `}>
                  <Zap className="w-3 h-3" />
                  {currentFps} FPS
                </div>
                <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-500/15 text-accent-500 uppercase tracking-wider">
                  {currentPreset}
                </div>
              </div>
            )}

            {!isActive ? (
              <Button
                variant="primary"
                onClick={() => startDesktopSession()}
                loading={isLoading}
                icon={<Play className="w-4 h-4" />}
              >
                {t('screenMirror.start')}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant={isRecording ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => {
                    if (isRecording) {
                      stopRecording()
                      showToast({ type: 'success', title: t('common.success'), message: t('screenMirror.recordingSaved') || 'Recording saved' })
                    } else if (canvasRef.current) {
                      startRecording(canvasRef.current, `desktop-${deviceInfo?.model || 'device'}`)
                    }
                  }}
                  className={isRecording ? 'bg-red-500 hover:bg-red-600 border-red-600 animate-pulse' : ''}
                  icon={isRecording ? <Circle className="w-4 h-4 fill-white animate-pulse" /> : <Video className="w-4 h-4" />}
                >
                  {isRecording ? formatDuration() : (t('screenMirror.record') || 'Record')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleFullscreen}
                  icon={<Maximize2 className="w-4 h-4" />}
                >
                  {t('screenMirror.fullScreen') || 'Full Screen'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsWebcamVisible(!isWebcamVisible)}
                  icon={isWebcamVisible ? <Webcam className="w-4 h-4 text-accent-500" /> : <Webcam className="w-4 h-4" />}
                >
                  {isWebcamVisible ? (t('screenMirror.hideCamera') || 'Hide Cam') : (t('screenMirror.showCamera') || 'Show Cam')}
                </Button>
                <Button
                  variant="secondary"
                  className="text-red-500 hover:bg-red-500/10"
                  onClick={() => { stopDesktopSession(); showToast({ type: 'info', title: t('desktopMode.stopped') }) }}
                  icon={<Square className="w-4 h-4" />}
                >
                  {t('screenMirror.stop')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-600 dark:text-red-400">{t('toast.error')}</p>
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{error}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Canvas Container */}
      <div className="flex-1 relative min-h-0">
        <div
          ref={displayContainerRef}
          onClick={() => {
            if (!isActive && !isLoading && !isAdapting) {
              startDesktopSession()
            }
          }}
          className={`
            absolute inset-0 bg-surface-950 dark:bg-black overflow-hidden shadow-elevated-lg transition-all duration-300 group
            ${isFullscreen ? 'w-full h-full rounded-none' : 'w-full flex-1 h-full'}
            ${(!isActive && !isLoading && !isAdapting) ? 'cursor-pointer hover:ring-4 ring-accent-500/30' : ''}
          `}
          style={{
            maxHeight: isFullscreen ? '100vh' : 'none',
            minHeight: '300px'
          }}
        >
          {(isLoading || isAdapting) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 transition-opacity duration-300">
              <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-accent-500 mx-auto mb-3" />
                <p className="text-white text-sm">
                  {isAdapting
                    ? (t('screenMirror.adaptingQuality') || 'Adapting quality...')
                    : (t('desktopMode.connecting') || 'Connecting to virtual display...')}
                </p>
              </div>
            </div>
          )}

          {!isActive && !isLoading && !isAdapting && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-100 dark:bg-surface-900 group-hover:bg-surface-200 dark:group-hover:bg-surface-800 transition-colors">
              <div className="text-center p-8">
                <Monitor className="w-16 h-16 mx-auto text-surface-600 group-hover:text-accent-500 transition-colors mb-4" strokeWidth={1} />
                <p className="text-surface-400 group-hover:text-surface-300 mb-4 transition-colors">
                  {t('desktopMode.clickToStart')}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-surface-500">
                  <Info className="w-4 h-4" />
                  <span>Android 13+ Virtual Display</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-accent-500/70 mt-2">
                  <Zap className="w-3 h-3" />
                  <span>{isAdaptiveEnabled
                    ? (t('screenMirror.adaptiveHint') || 'Starts at maximum quality with auto-adaptation')
                    : (t('screenMirror.manualHint') || 'Manual Mode: Maximum quality (Ultra)')
                  }</span>
                </div>
              </div>
            </div>
          )}


          <canvas
            ref={canvasRef}
            tabIndex={0}
            onContextMenu={async (e) => {
              e.preventDefault()
              if (!isActive || !scrcpyRef.current) return
              await scrcpyRef.current.sendKey(4, 'down')
              await scrcpyRef.current.sendKey(4, 'up')
            }}
            onPointerDown={(e) => {
              if (e.button === 2) return
              e.currentTarget.focus()
              handlePointerDown(e)
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPaste={async (e) => {
              if (!isActive || !scrcpyRef.current) return
              e.preventDefault()
              const text = e.clipboardData.getData('text')
              if (text) {
                await scrcpyRef.current.setClipboard(text, true)
                showToast({ type: 'success', title: 'Pasted to device' })
              }
            }}
            onKeyDown={async (e) => {
              if (!isActive || !scrcpyRef.current) return
              if (e.code === 'Escape') {
                e.preventDefault()
                await scrcpyRef.current.sendKey(4, 'down')
                return
              }
              if (e.metaKey || (e.code === 'MetaLeft' || e.code === 'MetaRight')) {
                e.preventDefault()
                await scrcpyRef.current.sendKey(3, 'down')
                return
              }
              let keyCode = -1
              switch (e.code) {
                case 'Enter': keyCode = 66; break
                case 'Backspace': keyCode = 67; break
                case 'Tab': keyCode = 61; break
                case 'ArrowUp': keyCode = 19; break
                case 'ArrowDown': keyCode = 20; break
                case 'ArrowLeft': keyCode = 21; break
                case 'ArrowRight': keyCode = 22; break
                case 'Delete': keyCode = 112; break
                case 'Home': keyCode = 3; break
                case 'PageUp': keyCode = 92; break
                case 'PageDown': keyCode = 93; break
              }

              if (keyCode !== -1) {
                e.preventDefault()
                await scrcpyRef.current.sendKey(keyCode, 'down')
                return
              }

              if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault()
                await scrcpyRef.current.sendText(e.key)
              }
            }}
            onKeyUp={async (e) => {
              if (!isActive || !scrcpyRef.current) return
              if (e.code === 'Escape') {
                e.preventDefault()
                await scrcpyRef.current.sendKey(4, 'up')
                return
              }
              if (e.code === 'MetaLeft' || e.code === 'MetaRight') {
                e.preventDefault()
                await scrcpyRef.current.sendKey(3, 'up')
                return
              }
              let keyCode = -1
              switch (e.code) {
                case 'Enter': keyCode = 66; break
                case 'Backspace': keyCode = 67; break
                case 'Tab': keyCode = 61; break
                case 'ArrowUp': keyCode = 19; break
                case 'ArrowDown': keyCode = 20; break
                case 'ArrowLeft': keyCode = 21; break
                case 'ArrowRight': keyCode = 22; break
                case 'Delete': keyCode = 112; break
                case 'Home': keyCode = 3; break
                case 'PageUp': keyCode = 92; break
                case 'PageDown': keyCode = 93; break
              }
              if (keyCode !== -1) {
                e.preventDefault()
                await scrcpyRef.current.sendKey(keyCode, 'up')
              }
            }}
            className={`
              block touch-none w-full h-full object-contain outline-none focus:ring-2 focus:ring-accent-500/50
              ${isActive ? 'cursor-pointer' : 'cursor-default'}
            `}
          />
        </div>
      </div>



      <ControlSheet
        isActive={isActive}
        isFullscreen={isFullscreen}
        isScreenOff={isScreenOff}
        isLoading={isLoading}
        isAdapting={isAdapting}
        isAdaptiveEnabled={isAdaptiveEnabled}
        currentPreset={currentPreset}
        qualityPresets={QUALITY_PRESETS}
        onQualitySelect={handleManualQualitySelect}
        onToggleAdaptive={setIsAdaptiveEnabled}
        onRestartMax={async () => { await stopDesktopSession(); await startDesktopSession(); }}
        onBack={async () => {
          await scrcpyRef.current?.sendKey(4, 'down')
          await scrcpyRef.current?.sendKey(4, 'up')
        }}
        onHome={async () => {
          await scrcpyRef.current?.sendKey(3, 'down')
          await scrcpyRef.current?.sendKey(3, 'up')
        }}
        onRecents={async () => {
          await scrcpyRef.current?.sendKey(187, 'down')
          await scrcpyRef.current?.sendKey(187, 'up')
        }}
        onVolUp={async () => {
          await scrcpyRef.current?.sendKey(24, 'down')
          await scrcpyRef.current?.sendKey(24, 'up')
        }}
        onVolDown={async () => {
          await scrcpyRef.current?.sendKey(25, 'down')
          await scrcpyRef.current?.sendKey(25, 'up')
        }}
        onPower={async () => {
          await scrcpyRef.current?.sendKey(26, 'down')
          await scrcpyRef.current?.sendKey(26, 'up')
        }}
        onScreenshot={handleScreenshot}
        onToggleFullscreen={toggleFullscreen}
        onToggleScreenPower={toggleScreenPower}
        onStop={() => { stopDesktopSession(); showToast({ type: 'info', title: t('desktopMode.stopped') }) }}
        onStart={() => startDesktopSession()}
        isRecording={isRecording}
        recordingDuration={formatDuration()}
        onRecord={() => {
          if (isRecording) {
            stopRecording()
            showToast({ type: 'success', title: t('common.success'), message: t('screenMirror.recordingSaved') || 'Recording saved' })
          } else if (canvasRef.current) {
            startRecording(canvasRef.current, `desktop-${deviceInfo?.model || 'device'}`)
            showToast({ type: 'info', title: t('screenMirror.recording') })
          }
        }}
        onToggleWebcam={() => setIsWebcamVisible(!isWebcamVisible)}
        webcamShape={webcamShape}
        onToggleWebcamShape={() => {
          const shapes: ('rect' | 'circle' | 'square' | 'video')[] = ['rect', 'circle', 'square', 'video']
          const next = shapes[(shapes.indexOf(webcamShape) + 1) % shapes.length]
          setWebcamShape(next)
        }}
      />

      {/* Webcam Overlay */}
      <WebcamOverlay
        isVisible={isWebcamVisible}
        onClose={() => setIsWebcamVisible(false)}
        onVideoElement={setWebcamVideoRef}
        onContainerElement={setWebcamContainerRef}
        dragConstraints={displayContainerRef}
        shape={webcamShape}
      />
    </div >
  )
}
