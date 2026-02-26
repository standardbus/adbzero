import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, VideoOff } from 'lucide-react'
import { useTranslation } from '@/stores/i18nStore'

export interface WebcamBounds {
    x: number
    y: number
    width: number
    height: number
}

export type OverlayShape = 'rect' | 'circle' | 'square' | 'video'

interface WebcamOverlayProps {
    isVisible: boolean
    onClose: () => void
    onVideoElement?: (el: HTMLVideoElement | null) => void // Allow external access for rendering
    onBoundsChange?: (bounds: WebcamBounds) => void
    onContainerElement?: (el: HTMLDivElement | null) => void // New prop for container access
    dragConstraints?: React.RefObject<Element>
    shape?: OverlayShape
}

export function WebcamOverlay({ isVisible, onClose, onVideoElement, onBoundsChange, onContainerElement, dragConstraints, shape = 'rect' }: WebcamOverlayProps) {
    const { t } = useTranslation() // eslint-disable-line @typescript-eslint/no-unused-vars
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [stream, setStream] = useState<MediaStream | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [size, setSize] = useState({ width: 320, height: 240 })

    // Position state to force re-render when dragging (for canvas sync)
    // Removed unused state
    const x = useRef(20)
    const y = useRef(20)

    // Reset size constraints when shape changes
    useEffect(() => {
        if (shape === 'circle' || shape === 'square') {
            const minDim = Math.min(size.width, size.height)
            setSize({ width: minDim, height: minDim })
        } else {
            // Restore default ratio if coming from square/circle?
            // Or just ensure width and height are decoupled.
            // For 'video' (plain rect) or 'rect' (rounded rect) we want 4:3 usually
            if (shape === 'video' || shape === 'rect') {
                // If it was square, restore aspect
                const w = size.width
                const h = w / (4 / 3)
                setSize({ width: w, height: h })
            }
        }
    }, [shape])

    // Initialize/Cleanup stream
    useEffect(() => {
        let currentStream: MediaStream | null = null;
        let mounted = true;

        const startCamera = async () => {
            if (isVisible) {
                try {
                    setError(null)
                    currentStream = await navigator.mediaDevices.getUserMedia({
                        video: true, // Use default constraints to maximize compatibility
                        audio: false
                    })
                    if (mounted) {
                        setStream(currentStream)
                        if (videoRef.current) {
                            videoRef.current.srcObject = currentStream
                        }
                    } else {
                        // Cleanup if unmounted before completion
                        currentStream.getTracks().forEach(track => track.stop())
                    }
                } catch (err) {
                    if (mounted) {
                        console.error('Failed to access camera:', err)
                        setError(t('screenMirror.cameraError') || 'Camera access denied')
                    }
                }
            } else {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop())
                    setStream(null)
                }
            }
        }

        startCamera()

        return () => {
            mounted = false;
            // Only stop if we created it in this effect instance, but simpler to check state
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop())
            }
        }
    }, [isVisible])

    // Update video element when stream state changes
    // Optimization: Only update srcObject if strictly needed
    useEffect(() => {
        if (!videoRef.current) return

        if (stream && videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream
        }

        // Always notify parent of the current ref
        onVideoElement?.(videoRef.current)

    }, [stream, onVideoElement])


    // Resize Logic
    const isResizing = useRef(false)
    const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 })

    const handleResizeMove = useCallback((e: PointerEvent) => {
        if (!isResizing.current) return
        const deltaX = e.clientX - resizeStart.current.x
        // Aspect ratio fits 4:3
        const aspectRatio = 4 / 3
        const newWidth = Math.max(160, resizeStart.current.width + deltaX)
        const newHeight = newWidth / aspectRatio

        setSize({
            width: newWidth,
            height: newHeight
        })

        // Force update for canvas sync
        onBoundsChange?.({ x: x.current, y: y.current, width: newWidth, height: newHeight })

    }, [onBoundsChange])

    const handleResizeEnd = useCallback(() => {
        isResizing.current = false
        window.removeEventListener('pointermove', handleResizeMove)
        window.removeEventListener('pointerup', handleResizeEnd)
    }, [handleResizeMove])

    const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        isResizing.current = true
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height
        }

        window.addEventListener('pointermove', handleResizeMove)
        window.addEventListener('pointerup', handleResizeEnd)
    }

    useEffect(() => {
        if (containerRef.current) {
            onContainerElement?.(containerRef.current)
        } else {
            onContainerElement?.(null)
        }
    }, [isVisible, onContainerElement])

    // Shape Styles override
    const getShapeStyle = () => {
        switch (shape) {
            case 'circle': return 'rounded-full aspect-square'
            case 'square': return 'rounded-none aspect-square'
            case 'video': return 'rounded-none' // plain rect
            default: return 'rounded-2xl' // rect
        }
    }

    // Cleanup refs and event listeners on unmount
    useEffect(() => {
        const currentHandleResizeMove = handleResizeMove
        const currentHandleResizeEnd = handleResizeEnd

        return () => {
            // Cleanup refs
            onVideoElement?.(null)
            onContainerElement?.(null)
            // Cleanup resize event listeners in case component unmounts during resize
            window.removeEventListener('pointermove', currentHandleResizeMove)
            window.removeEventListener('pointerup', currentHandleResizeEnd)
            isResizing.current = false
        }
    }, [handleResizeMove, handleResizeEnd, onVideoElement, onContainerElement])

    // Also cleanup stream on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }
        }
    }, [stream])

    if (!isVisible) return null


    return (
        <motion.div
            drag
            dragMomentum={false}
            dragConstraints={dragConstraints}
            dragElastic={0} // Prevent dragging outside constraints
            // Use ref for external access if we wanted to measure DOM directly
            ref={containerRef}
            initial={{ x: 20, y: 20, opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onDrag={() => {
                // Sync position logic
                // We don't have absolute coordinates easily here relative to parent without ref checks
                // But we can trigger a re-render/callback
                // Actually the parent uses onOverlayDrawer which reads getBoundingClientRect() directly
                // So we just need to ensure the parent re-renders 60fps? 
                // No, the parent's draw loop runs on animation frame or scrcpy frame.
                // We just need to make sure the DOM is updated. Framer motion does that directly.
                // So we don't necessarily need to set state here causing re-renders.
            }}
            style={{
                width: size.width,
                height: shape === 'circle' || shape === 'square' ? size.width : size.height,
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 50,
            }}
            className={`overflow-hidden shadow-2xl ring-1 ring-white/10 group bg-black ${getShapeStyle()}`}
        >
            {/* Header / Drag Handle - visible on hover */}
            {/* Modified to be minimally intrusive for shapes like circle */}
            <div className={`absolute top-0 left-0 right-0 h-full opacity-0 group-hover:opacity-100 transition-opacity z-20 flex flex-col justify-between p-2`}>
                <div className="flex justify-end">
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose() }}
                        className="p-1 rounded-full bg-black/40 text-white/80 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>

                {/* Resize Handle only for non-fixed shapes? or all? */}
                <div
                    onPointerDown={handleResizeStart}
                    className="self-end w-6 h-6 flex items-center justify-center cursor-nwse-resize"
                >
                    <div className="w-3 h-3 bg-white/20 rounded-tl-sm hover:bg-accent-500 transition-colors" />
                </div>
            </div>

            {/* Video Content */}
            {error ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 p-4 text-center">
                    <VideoOff className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs">{error}</p>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover pointer-events-none" // pointer-events-none to allow drag on container
                />
            )}
        </motion.div>
    )
}
