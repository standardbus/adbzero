import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    Home,
    Layers,
    Volume2,
    Plus,
    Minus,
    Power,
    Maximize2,
    Minimize2,
    Camera,
    Square,
    Play,
    Zap,
    X,
    Monitor,
    MonitorOff,
    Video,
    Circle,
    Webcam
} from 'lucide-react'
import { useTranslation } from '@/stores/i18nStore'
import { Switch } from '@/components/ui/Switch'

interface ControlSheetProps {
    isActive: boolean
    isFullscreen: boolean
    isScreenOff: boolean
    isLoading: boolean
    isAdapting?: boolean
    isAdaptiveEnabled?: boolean
    currentPreset?: string
    qualityPresets?: any[]
    onQualitySelect?: (presetName: string) => void
    onToggleAdaptive?: (enabled: boolean) => void
    onRestartMax?: () => void
    onBack: () => void
    onHome: () => void
    onRecents: () => void
    onVolUp: () => void
    onVolDown: () => void
    onPower: () => void
    onScreenshot: () => void
    onToggleFullscreen: () => void
    onToggleScreenPower: () => void
    onStop: () => void
    onStart: () => void
    // Recording
    isRecording?: boolean
    recordingDuration?: string
    onRecord?: () => void
    // Webcam
    isWebcamVisible?: boolean
    onToggleWebcam?: () => void
    webcamShape?: 'rect' | 'circle' | 'square' | 'video'
    onToggleWebcamShape?: () => void
}

export function ControlSheet({
    isActive,
    isFullscreen,
    isScreenOff,
    isLoading,
    isAdapting = false,
    isAdaptiveEnabled = false,
    currentPreset,
    qualityPresets = [],
    onQualitySelect,
    onToggleAdaptive,
    onRestartMax,
    onBack,
    onHome,
    onRecents,
    onVolUp,
    onVolDown,
    onPower,
    onScreenshot,
    onToggleFullscreen,
    onToggleScreenPower,
    onStop,
    onStart,
    isRecording,
    recordingDuration,
    onRecord,
    isWebcamVisible,
    onToggleWebcam,
    webcamShape,
    onToggleWebcamShape
}: ControlSheetProps) {
    const { t } = useTranslation()
    const [isOpen, setIsOpen] = useState(false)
    const [handlePosition, setHandlePosition] = useState({ x: 0, y: 0 })
    const isDragging = useRef(false)

    // Handle opening via click
    const toggleSheet = () => {
        if (!isDragging.current) {
            setIsOpen(!isOpen)
        }
    }

    // Handle is only visible in fullscreen
    if (!isFullscreen) return null

    return (
        <div className="fixed inset-0 pointer-events-none z-[100]">
            {/* Handle / Trigger */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.div
                        drag
                        dragMomentum={false}
                        initial={handlePosition.x === 0 && handlePosition.y === 0 ? { y: -50, x: 50, opacity: 0 } : false}
                        animate={{ x: handlePosition.x, y: handlePosition.y, opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed top-6 right-6 pointer-events-auto cursor-grab active:cursor-grabbing z-[101]"
                        onDragStart={() => { isDragging.current = true }}
                        onDragEnd={(_, info) => {
                            setHandlePosition(prev => ({
                                x: prev.x + info.offset.x,
                                y: prev.y + info.offset.y
                            }))
                            // Small timeout to prevent immediate click
                            setTimeout(() => { isDragging.current = false }, 100)
                        }}
                        onClick={toggleSheet}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {/* High-Contrast Grabber Style */}
                        <div className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-800 border border-white/20 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-3 ring-2 ring-accent-500/50">
                            <div className="w-8 h-1 bg-accent-500 rounded-full shadow-[0_0_10px_rgba(var(--accent-500-rgb),0.6)]" />
                            <span className="text-[10px] font-black text-zinc-100 uppercase tracking-[0.2em] select-none whitespace-nowrap">
                                adbzero.com
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Sheet */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop for dismissal */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-[4px] pointer-events-auto"
                        />

                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-[#1c1c1e]/90 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl rounded-t-[32px] border-t border-white/10 shadow-2xl pointer-events-auto flex flex-col overflow-hidden max-h-[90vh]"
                        >
                            {/* Grabber */}
                            <div className="w-full h-10 flex items-center justify-center cursor-pointer flex-shrink-0" onClick={() => setIsOpen(false)}>
                                <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                            </div>

                            <div className="flex-1 overflow-y-auto pb-10 scrollbar-hide">
                                {/* Header Info */}
                                <div className="px-8 flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-accent-500/20 flex items-center justify-center">
                                            <Monitor className="w-6 h-6 text-accent-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-xl">ADB Zero/0</h3>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                <p className="text-white/40 text-[10px] uppercase tracking-widest font-black">
                                                    {isActive ? t('history.connected') : t('common.inactive')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Main Grid Controls */}
                                <div className="px-8 grid grid-cols-4 gap-4 mb-8">
                                    {/* Navigation Group */}
                                    <ControlButton
                                        icon={<ArrowLeft className="w-6 h-6" />}
                                        label={t('screenMirror.nav.back')}
                                        onClick={() => { onBack(); }}
                                        disabled={!isActive}
                                    />
                                    <ControlButton
                                        icon={<Home className="w-6 h-6" />}
                                        label={t('screenMirror.nav.home')}
                                        onClick={() => { onHome(); }}
                                        disabled={!isActive}
                                    />
                                    <ControlButton
                                        icon={<Layers className="w-6 h-6" />}
                                        label={t('screenMirror.nav.recents')}
                                        onClick={() => { onRecents(); }}
                                        disabled={!isActive}
                                    />
                                    <ControlButton
                                        icon={<Power className="w-6 h-6" />}
                                        label={t('screenMirror.nav.power')}
                                        onClick={() => { onPower(); }}
                                        disabled={!isActive}
                                        danger
                                    />

                                    {/* Media/Utility Group */}
                                    <ControlButton
                                        icon={<div className="flex items-start"><Volume2 className="w-5 h-5" /><Plus className="w-3 h-3 -mt-1" /></div>}
                                        label={t('screenMirror.nav.volUp')}
                                        onClick={() => { onVolUp(); }}
                                        disabled={!isActive}
                                    />
                                    <ControlButton
                                        icon={<div className="flex items-start"><Volume2 className="w-5 h-5" /><Minus className="w-3 h-3 -mt-1" /></div>}
                                        label={t('screenMirror.nav.volDown')}
                                        onClick={() => { onVolDown(); }}
                                        disabled={!isActive}
                                    />
                                    <ControlButton
                                        icon={<Camera className="w-6 h-6" />}
                                        label={t('screenMirror.screenshot')}
                                        onClick={() => { onScreenshot(); }}
                                        disabled={!isActive}
                                    />
                                    <ControlButton
                                        icon={isScreenOff ? <Monitor className="w-6 h-6" /> : <MonitorOff className="w-6 h-6" />}
                                        label={isScreenOff ? t('screenMirror.turnOn') : t('screenMirror.turnOff')}
                                        onClick={() => { onToggleScreenPower(); }}
                                        disabled={!isActive}
                                    />
                                    {onRecord && (
                                        <ControlButton
                                            icon={isRecording ? <Circle className="w-6 h-6 fill-red-500 animate-pulse text-red-500" /> : <Video className="w-6 h-6" />}
                                            label={isRecording ? (recordingDuration || 'REC') : t('screenMirror.record')}
                                            onClick={onRecord}
                                            disabled={!isActive}
                                            danger={isRecording}
                                        />
                                    )}
                                    {onToggleWebcam && (
                                        <ControlButton
                                            icon={isWebcamVisible ? <Webcam className="w-6 h-6 text-accent-500" /> : <Webcam className="w-6 h-6" />}
                                            label={isWebcamVisible ? t('screenMirror.hideCamera') || 'Hide Cam' : t('screenMirror.showCamera') || 'Show Cam'}
                                            onClick={onToggleWebcam}
                                            disabled={!isActive && false} // Camera can be on even if not mirroring? Maybe. But let's keep it simple.
                                        />
                                    )}
                                    {isWebcamVisible && onToggleWebcamShape && (
                                        <ControlButton
                                            icon={
                                                webcamShape === 'circle' ? <Circle className="w-6 h-6" /> :
                                                    webcamShape === 'square' ? <Square className="w-6 h-6" /> :
                                                        webcamShape === 'video' ? <Video className="w-6 h-6" /> :
                                                            <div className="w-6 h-4 border-2 border-current rounded-md box-border" /> // Rect icon
                                            }
                                            label={webcamShape || 'Shape'}
                                            onClick={onToggleWebcamShape}
                                            disabled={!isActive}
                                        />
                                    )}
                                </div>

                                {/* Quality & Settings Section */}
                                <div className="px-8 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-white/60 text-xs font-bold uppercase tracking-widest">{t('screenMirror.options')}</h4>
                                        {isActive && onRestartMax && (
                                            <button
                                                onClick={onRestartMax}
                                                className="text-[10px] text-amber-500 hover:text-amber-400 font-bold uppercase"
                                            >
                                                {t('screenMirror.restartMax')}
                                            </button>
                                        )}
                                    </div>

                                    {/* Adaptive Toggle */}
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAdaptiveEnabled ? 'bg-accent-500/20 text-accent-500' : 'bg-white/5 text-white/20'}`}>
                                                <Zap className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">{t('screenMirror.enableAdaptive')}</p>
                                                <p className="text-[10px] text-white/40">{t('screenMirror.enableAdaptiveDesc')}</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={isAdaptiveEnabled}
                                            onChange={(val) => onToggleAdaptive?.(val)}
                                            disabled={isAdapting}
                                            size="sm"
                                        />
                                    </div>

                                    {/* Quality Grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {qualityPresets.map((preset) => (
                                            <button
                                                key={preset.name}
                                                onClick={() => onQualitySelect?.(preset.name)}
                                                className={`
                                                    p-3 rounded-2xl border transition-all text-left group
                                                    ${currentPreset === preset.name
                                                        ? 'bg-accent-500 border-accent-600 text-white shadow-lg'
                                                        : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                                    }
                                                `}
                                            >
                                                <p className="text-[10px] font-black uppercase tracking-widest mb-1">{preset.name}</p>
                                                <p className={`text-[9px] font-medium ${currentPreset === preset.name ? 'text-white/80' : 'text-white/30'}`}>
                                                    {(preset.bitRate / 1_000_000).toFixed(0)} Mbps / {preset.maxFps} FPS
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Fixed Actions */}
                            <div className="px-8 py-6 bg-black/20 border-t border-white/5 flex items-center gap-4 flex-shrink-0">
                                <button
                                    onClick={onToggleFullscreen}
                                    className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-3 text-white font-bold hover:bg-white/10 transition-all shadow-xl"
                                >
                                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                                    {isFullscreen ? t('screenMirror.nav.fullOff') : t('screenMirror.nav.fullOn')}
                                </button>

                                <button
                                    onClick={isActive ? onStop : onStart}
                                    disabled={isLoading}
                                    className={`
                                        w-20 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl
                                        ${isActive
                                            ? 'bg-red-500 text-white hover:bg-red-600'
                                            : 'bg-accent-500 text-white hover:bg-accent-600'
                                        }
                                    `}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        isActive ? <Square className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

function ControlButton({ icon, label, onClick, disabled, danger }: { icon: any, label: string, onClick: () => void, disabled?: boolean, danger?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-2">
            <motion.button
                whileTap={{ scale: 0.9 }}
                disabled={disabled}
                onClick={onClick}
                className={`
          w-full aspect-square rounded-[22px] flex items-center justify-center transition-all
          ${disabled
                        ? 'bg-white/5 opacity-30 cursor-not-allowed text-white/20'
                        : danger
                            ? 'bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20'
                            : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    }
        `}
            >
                {icon}
            </motion.button>
            <span className={`text-[8px] font-black uppercase tracking-widest text-center line-clamp-1 ${disabled ? 'text-white/10' : 'text-white/40'}`}>
                {label}
            </span>
        </div>
    )
}

function Loader2(props: any) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
