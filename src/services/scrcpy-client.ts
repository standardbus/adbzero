import { Adb } from '@yume-chan/adb'
import { AdbScrcpyClient, AdbScrcpyOptions3_0 } from '@yume-chan/adb-scrcpy'
import {
    ScrcpyVideoCodecId,
    AndroidMotionEventAction,
    AndroidKeyEventAction,
    AndroidKeyCode,
    AndroidScreenPowerMode,
    ScrcpyNewDisplay
} from '@yume-chan/scrcpy'


import { WebCodecsVideoDecoder } from '@yume-chan/scrcpy-decoder-webcodecs'
// import { ReadableStream } from '@yume-chan/stream-extra' 

// Cache for the server binary
let serverBinaryCache: ArrayBuffer | null = null

// ============= ADAPTIVE QUALITY =============

/**
 * Quality tiers for adaptive streaming.
 * The system starts at the highest tier and steps down when lag is detected.
 */
export interface QualityPreset {
    name: string
    maxSize: number       // 0 = native
    bitRate: number
    maxFps: number
}

export const QUALITY_PRESETS: QualityPreset[] = [
    { name: 'ultra', maxSize: 0, bitRate: 20_000_000, maxFps: 60 },
    { name: 'high', maxSize: 1920, bitRate: 12_000_000, maxFps: 60 },
    { name: 'standard', maxSize: 1080, bitRate: 8_000_000, maxFps: 60 },
    { name: 'medium', maxSize: 1080, bitRate: 4_000_000, maxFps: 30 },
    { name: 'low', maxSize: 720, bitRate: 2_000_000, maxFps: 30 },
    { name: 'minimal', maxSize: 480, bitRate: 1_000_000, maxFps: 30 },
]

/** Get the default (highest) quality preset */
export function getDefaultPreset(): QualityPreset {
    return QUALITY_PRESETS[0]
}

/** Gets the next lower quality preset, or null if already at minimum */
export function getLowerPreset(currentName: string): QualityPreset | null {
    const idx = QUALITY_PRESETS.findIndex(p => p.name === currentName)
    if (idx < 0 || idx >= QUALITY_PRESETS.length - 1) return null
    return QUALITY_PRESETS[idx + 1]
}

/** Gets preset by name */
export function getPresetByName(name: string): QualityPreset | undefined {
    return QUALITY_PRESETS.find(p => p.name === name)
}

// ============= FPS MONITOR =============

interface FpsMonitorConfig {
    /** FPS below this triggers a "slow" sample (default: 20) */
    fpsThreshold: number
    /** How often to check FPS in ms (default: 2000) */
    checkIntervalMs: number
    /** How many consecutive "slow" checks before emitting degraded (default: 3) */
    slowChecksBeforeDegrade: number
}

const DEFAULT_FPS_CONFIG: FpsMonitorConfig = {
    fpsThreshold: 15, // Lower threshold (was 20)
    checkIntervalMs: 5000, // Longer interval (was 2000)
    slowChecksBeforeDegrade: 4, // More checks (was 3) => Total 20s of sustained low FPS
}

class FpsMonitor {
    private frameCount = 0
    private lastCheckTime = 0
    private consecutiveSlowChecks = 0
    private intervalId: ReturnType<typeof setInterval> | null = null
    private config: FpsMonitorConfig
    private currentFps = 0
    private onDegraded: (() => void) | null = null

    constructor(config?: Partial<FpsMonitorConfig>) {
        this.config = { ...DEFAULT_FPS_CONFIG, ...config }
    }

    /** Call this every time a frame is rendered */
    recordFrame() {
        this.frameCount++
    }

    /** Start monitoring. Calls onDegraded when sustained slowness is detected. */
    start(onDegraded: () => void) {
        this.onDegraded = onDegraded
        this.frameCount = 0
        this.lastCheckTime = performance.now()
        this.consecutiveSlowChecks = 0
        this.currentFps = 0

        this.intervalId = setInterval(() => {
            this.check()
        }, this.config.checkIntervalMs)
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
        this.onDegraded = null
    }

    getFps(): number {
        return this.currentFps
    }

    private check() {
        const now = performance.now()
        const elapsed = (now - this.lastCheckTime) / 1000

        if (elapsed <= 0) return

        this.currentFps = Math.round(this.frameCount / elapsed)
        this.frameCount = 0
        this.lastCheckTime = now

        console.log(`[FpsMonitor] Current FPS: ${this.currentFps}`)

        if (this.currentFps < this.config.fpsThreshold && this.currentFps > 0) {
            this.consecutiveSlowChecks++
            console.warn(`[FpsMonitor] Slow frame rate detected (${this.currentFps} FPS), streak: ${this.consecutiveSlowChecks}/${this.config.slowChecksBeforeDegrade}`)

            if (this.consecutiveSlowChecks >= this.config.slowChecksBeforeDegrade) {
                console.warn(`[FpsMonitor] Sustained low FPS — recommending quality downgrade`)
                this.consecutiveSlowChecks = 0 // Reset so it doesn't fire repeatedly
                this.onDegraded?.()
            }
        } else {
            // Reset if FPS recovers
            this.consecutiveSlowChecks = 0
        }
    }
}

// ============= SESSION =============

export interface ScrcpySessionCallbacks {
    /** Called when sustained low FPS is detected. The consumer should restart with a lower preset. */
    onQualityDegraded?: (currentPreset: string, suggestedPreset: QualityPreset | null) => void
    /** Called when FPS is updated (for UI display) */
    onFpsUpdate?: (fps: number) => void
}

export class ScrcpySession {
    private adb: Adb
    private client: AdbScrcpyClient<any> | null = null
    private decoder: WebCodecsVideoDecoder | null = null
    private active = false
    private screenWidth = 1080
    private screenHeight = 2400
    private videoAbortController: AbortController | null = null
    private clipboardAbortController: AbortController | null = null
    private onClipboardCallback: ((text: string) => void) | null = null

    // Adaptive quality
    private fpsMonitor: FpsMonitor
    private callbacks: ScrcpySessionCallbacks = {}
    private currentPresetName = 'ultra'
    private fpsUpdateInterval: ReturnType<typeof setInterval> | null = null

    constructor(adb: Adb, callbacks?: ScrcpySessionCallbacks) {
        this.adb = adb
        this.callbacks = callbacks || {}
        this.fpsMonitor = new FpsMonitor()
    }

    /**
     * Fetches the scrcpy-server from local public folder
     */
    private async fetchServerBinary(): Promise<ArrayBuffer> {
        console.log(`[Scrcpy] Fetching server binary...`)

        // Use cached version if available
        if (serverBinaryCache) {
            console.log('[Scrcpy] Using cached server binary')
            return serverBinaryCache
        }

        try {
            const response = await fetch('/scrcpy-server.jar', { cache: 'no-cache' })
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            const buffer = await response.arrayBuffer()
            if (buffer.byteLength < 1000) {
                throw new Error('Local server file too small or corrupted')
            }
            console.log(`[Scrcpy] Downloaded server, size: ${buffer.byteLength} bytes`)
            serverBinaryCache = buffer
            return buffer
        } catch (error: any) {
            throw new Error(
                `Failed to load scrcpy-server.jar from /public/. ` +
                `Ensure the file exists and is accessible. ` +
                `Error: ${error.message}`
            )
        }
    }

    /**
     * Pushes the server binary to the device
     */
    private async pushServer(): Promise<string> {
        const serverBuffer = await this.fetchServerBinary()
        const serverPath = '/data/local/tmp/scrcpy-server.jar'

        console.log(`[Scrcpy] Pushing server to device...`)

        try {
            const serverData = new Uint8Array(serverBuffer)

            // Create a proper ReadableStream 
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(serverData)
                    controller.close()
                }
            })

            // Cast to any because library expects its own ReadableStream type
            await AdbScrcpyClient.pushServer(this.adb, stream as any)

            console.log('[Scrcpy] Server pushed successfully')
            return serverPath
        } catch (error: any) {
            console.error('[Scrcpy] Failed to push server:', error)
            throw new Error(`Failed to push scrcpy-server to device: ${error.message}`)
        }
    }

    private overlayDrawer: ((ctx: CanvasRenderingContext2D) => void) | null = null

    setOverlayDrawer(drawer: ((ctx: CanvasRenderingContext2D) => void) | null) {
        this.overlayDrawer = drawer
    }

    /**
     * Creates a draw renderer that records frames to the FPS monitor
     */
    private createRenderer(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d')!
        const monitor = this.fpsMonitor

        return {
            setSize: (width: number, height: number) => {
                this.screenWidth = width
                this.screenHeight = height
                canvas.width = width
                canvas.height = height
                console.log(`[Scrcpy] Size changed: ${width}x${height}`)
            },
            draw: (frame: VideoFrame) => {
                ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
                frame.close()
                monitor.recordFrame()

                // Draw overlay if configured
                if (this.overlayDrawer) {
                    try {
                        this.overlayDrawer(ctx)
                    } catch (e) {
                        console.error('Overlay draw error', e)
                    }
                }
            }
        }
    }

    /**
     * Starts FPS monitoring and auto-degrade logic
     */
    private startFpsMonitoring() {
        this.fpsMonitor.start(() => {
            // Sustained slowness detected
            const lower = getLowerPreset(this.currentPresetName)
            console.warn(`[Scrcpy] Quality degraded signal — current: ${this.currentPresetName}, suggesting: ${lower?.name ?? 'none'}`)
            this.callbacks.onQualityDegraded?.(this.currentPresetName, lower)
        })

        // Emit FPS updates to UI every second
        this.fpsUpdateInterval = setInterval(() => {
            this.callbacks.onFpsUpdate?.(this.fpsMonitor.getFps())
        }, 1000)
    }

    private stopFpsMonitoring() {
        this.fpsMonitor.stop()
        if (this.fpsUpdateInterval) {
            clearInterval(this.fpsUpdateInterval)
            this.fpsUpdateInterval = null
        }
    }

    async start(canvas: HTMLCanvasElement, config?: { maxSize?: number, bitRate?: number, maxFps?: number, presetName?: string }) {
        if (this.active) {
            console.log('[Scrcpy] Session already active')
            return
        }

        // Determine preset
        const preset = config?.presetName
            ? (getPresetByName(config.presetName) || getDefaultPreset())
            : getDefaultPreset()

        this.currentPresetName = config?.presetName || preset.name

        // Use config overrides or preset defaults
        const maxSize = config?.maxSize ?? preset.maxSize
        const bitRate = config?.bitRate ?? preset.bitRate
        const maxFps = config?.maxFps ?? preset.maxFps

        this.videoAbortController = new AbortController()

        try {
            console.log('[Scrcpy] === Starting Session ===')
            console.log(`[Scrcpy] Preset: ${this.currentPresetName} | maxSize: ${maxSize || 'native'} | bitRate: ${(bitRate / 1_000_000).toFixed(1)}Mbps | maxFps: ${maxFps}`)

            // Step 1: Push server to device
            const serverPath = await this.pushServer()

            // Step 2: Create options
            console.log('[Scrcpy] Creating options...')

            const options = new AdbScrcpyOptions3_0({
                audio: false,
                maxSize: maxSize || undefined,
                videoBitRate: bitRate,
                logLevel: 'error',
                maxFps,
                tunnelForward: true,
                clipboardAutosync: true,
            }, { version: '3.1' })

            // Step 3: Start the client
            console.log('[Scrcpy] Starting client...')

            // Manual log for transparency (scrcpy uses its own stream protocol to spawn)
            import('@/stores/adbStore').then(({ useAdbStore }) => {
                useAdbStore.getState().addCommandLog({
                    command: `CLASSPATH=${serverPath} app_process / scrcpy.Server 3.1 (videoBitRate=${bitRate}, maxSize=${maxSize}, maxFps=${maxFps})`,
                    result: 'success',
                    message: 'Scrcpy server started'
                })
            })

            this.client = await AdbScrcpyClient.start(
                this.adb,
                serverPath,
                options
            )

            console.log('[Scrcpy] Client started')

            // Start clipboard monitoring if available
            if (this.client.clipboard) {
                this.clipboardAbortController = new AbortController()
                this.monitorClipboard(this.client.clipboard, this.clipboardAbortController.signal)
            }

            // Step 4: Get and process video stream
            const videoStreamPromise = this.client.videoStream
            if (!videoStreamPromise) {
                throw new Error('No video stream available')
            }

            const videoStream = await videoStreamPromise

            if (!videoStream || !videoStream.metadata) {
                throw new Error('Invalid video stream metadata')
            }

            // Get dimensions from metadata
            this.screenWidth = videoStream.metadata.width || 1080
            this.screenHeight = videoStream.metadata.height || 2400
            console.log(`[Scrcpy] Screen: ${this.screenWidth}x${this.screenHeight}`)

            // Resize canvas
            canvas.width = this.screenWidth
            canvas.height = this.screenHeight

            // Step 5: Create decoder with renderer
            console.log('[Scrcpy] Creating decoder...')

            this.decoder = new WebCodecsVideoDecoder({
                codec: videoStream.metadata.codec ?? ScrcpyVideoCodecId.H264,
                renderer: this.createRenderer(canvas)
            })

            // Step 6: Pipe video stream to decoder
            this.active = true
            console.log('[Scrcpy] === Session Started ===')

            // Start FPS monitoring for adaptive quality
            this.startFpsMonitoring()

            // The stream pipe needs signal
            videoStream.stream
                .pipeTo(this.decoder.writable as any, { signal: this.videoAbortController.signal })
                .catch((err: any) => {
                    if (err.name !== 'AbortError') {
                        console.error('[Scrcpy] Stream error:', err)
                    }
                })

        } catch (error: any) {
            console.error('[Scrcpy] Start failed:', error)
            this.stop()
            throw error
        }
    }

    async startDesktop(canvas: HTMLCanvasElement, config: { width: number, height: number, dpi: number, bitRate?: number, maxFps?: number, presetName?: string }) {
        if (this.active) {
            console.log('[Scrcpy] Session already active')
            return
        }

        // Determine preset
        const preset = config?.presetName
            ? (getPresetByName(config.presetName) || getDefaultPreset())
            : getDefaultPreset()

        this.currentPresetName = config?.presetName || preset.name

        const bitRate = config.bitRate ?? preset.bitRate
        const maxFps = config.maxFps ?? preset.maxFps

        this.videoAbortController = new AbortController()

        try {
            console.log('[Scrcpy] === Starting Desktop Session ===')
            console.log(`[Scrcpy] Preset: ${this.currentPresetName} | ${config.width}x${config.height}/${config.dpi} | bitRate: ${(bitRate / 1_000_000).toFixed(1)}Mbps | maxFps: ${maxFps}`)

            const serverPath = await this.pushServer()

            const options = new AdbScrcpyOptions3_0({
                audio: false,
                videoBitRate: bitRate,
                logLevel: 'error',
                maxFps,
                tunnelForward: true,
                clipboardAutosync: true,
                newDisplay: new ScrcpyNewDisplay(config.width, config.height, config.dpi),
            }, { version: '3.1' })

            console.log('[Scrcpy] Starting client with virtual display...')

            // Manual log for transparency
            import('@/stores/adbStore').then(({ useAdbStore }) => {
                useAdbStore.getState().addCommandLog({
                    command: `CLASSPATH=${serverPath} app_process / scrcpy.Server 3.1 (videoBitRate=${bitRate}, newDisplay=${config.width}x${config.height}/${config.dpi})`,
                    result: 'success',
                    message: 'Scrcpy desktop server started'
                })
            })

            this.client = await AdbScrcpyClient.start(
                this.adb,
                serverPath,
                options
            )

            console.log('[Scrcpy] Client started (desktop mode)')

            if (this.client.clipboard) {
                this.clipboardAbortController = new AbortController()
                this.monitorClipboard(this.client.clipboard, this.clipboardAbortController.signal)
            }

            const videoStreamPromise = this.client.videoStream
            if (!videoStreamPromise) {
                throw new Error('No video stream available')
            }

            const videoStream = await videoStreamPromise

            if (!videoStream || !videoStream.metadata) {
                throw new Error('Invalid video stream metadata')
            }

            this.screenWidth = videoStream.metadata.width || config.width
            this.screenHeight = videoStream.metadata.height || config.height
            console.log(`[Scrcpy] Virtual display active: ${this.screenWidth}x${this.screenHeight}`)

            canvas.width = this.screenWidth
            canvas.height = this.screenHeight

            console.log('[Scrcpy] Creating decoder...')

            this.decoder = new WebCodecsVideoDecoder({
                codec: videoStream.metadata.codec ?? ScrcpyVideoCodecId.H264,
                renderer: this.createRenderer(canvas)
            })

            this.active = true
            console.log('[Scrcpy] === Desktop Session Started ===')

            // Start FPS monitoring for adaptive quality
            this.startFpsMonitoring()

            videoStream.stream
                .pipeTo(this.decoder.writable as any, { signal: this.videoAbortController.signal })
                .catch((err: any) => {
                    if (err.name !== 'AbortError') {
                        console.error('[Scrcpy] Stream error:', err)
                    }
                })

        } catch (error: any) {
            console.error('[Scrcpy] Desktop start failed:', error)
            this.stop()
            throw error
        }
    }

    stop() {
        console.log('[Scrcpy] Stopping session...')
        this.active = false

        // Stop FPS monitoring
        this.stopFpsMonitoring()

        // Abort video streaming
        if (this.videoAbortController) {
            this.videoAbortController.abort()
            this.videoAbortController = null
        }

        // Abort clipboard monitoring
        if (this.clipboardAbortController) {
            this.clipboardAbortController.abort()
            this.clipboardAbortController = null
        }

        // Close client
        if (this.client) {
            try {
                this.client.close()
            } catch (e) {
                console.warn('[Scrcpy] Error closing client:', e)
            }
            this.client = null
        }

        // Dispose decoder
        if (this.decoder) {
            try {
                this.decoder.dispose()
            } catch (e) {
                console.warn('[Scrcpy] Error disposing decoder:', e)
            }
            this.decoder = null
        }

        console.log('[Scrcpy] Session stopped')
    }

    get controller() {
        return this.client?.controller
    }

    get isActive() {
        return this.active
    }

    get currentPreset(): string {
        return this.currentPresetName
    }

    get fps(): number {
        return this.fpsMonitor.getFps()
    }

    async sendTouch(type: 'down' | 'move' | 'up', x: number, y: number) {
        if (!this.active || !this.client?.controller) return

        const pointerX = Math.round(x * this.screenWidth)
        const pointerY = Math.round(y * this.screenHeight)

        let action: typeof AndroidMotionEventAction[keyof typeof AndroidMotionEventAction]
        switch (type) {
            case 'down': action = AndroidMotionEventAction.Down; break
            case 'move': action = AndroidMotionEventAction.Move; break
            case 'up': action = AndroidMotionEventAction.Up; break
        }

        try {
            await this.client.controller.injectTouch({
                action,
                pointerId: BigInt(0),
                pointerX,
                pointerY,
                videoWidth: this.screenWidth,
                videoHeight: this.screenHeight,
                pressure: type === 'up' ? 0 : 1,
                actionButton: 1,
                buttons: type === 'up' ? 0 : 1
            })
        } catch (error) {
            console.error('[Scrcpy] Touch injection failed:', error)
        }
    }

    async sendKey(keyCode: number, action: 'down' | 'up' = 'down') {
        if (!this.active || !this.client?.controller) return

        try {
            // Cast keyCode
            const androidKeyCode = keyCode as unknown as AndroidKeyCode

            await this.client.controller.injectKeyCode({
                action: action === 'down' ? AndroidKeyEventAction.Down : AndroidKeyEventAction.Up,
                keyCode: androidKeyCode,
                repeat: 0,
                metaState: 0
            })

        } catch (error) {
            console.error('[Scrcpy] Key injection failed:', error)
        }
    }

    async sendText(text: string) {
        if (!this.active || !this.client?.controller) return
        try {
            await this.client.controller.injectText(text)
        } catch (error) {
            console.error('[Scrcpy] Text injection failed:', error)
        }
    }

    private async monitorClipboard(stream: any, signal: AbortSignal) {
        console.log('[Scrcpy] Clipboard monitoring started')
        const reader = stream.getReader()
        try {
            while (true) {
                if (signal.aborted) break
                const { done, value } = await reader.read()
                if (done) break
                if (value && this.onClipboardCallback) {
                    console.log('[Scrcpy] Clipboard device -> PC:', value)
                    this.onClipboardCallback(value)
                }
            }
        } catch (e: any) {
            if (e.name !== 'AbortError' && !signal.aborted) {
                console.error('[Scrcpy] Clipboard monitor error:', e)
            }
        } finally {
            // reader.releaseLock() is generally good practice
            try { reader.releaseLock() } catch { }
        }
    }

    setClipboardCallback(callback: (text: string) => void) {
        this.onClipboardCallback = callback
    }

    async setClipboard(text: string, paste: boolean = false) {
        if (!this.active || !this.client?.controller) return
        try {
            await this.client.controller.setClipboard({
                sequence: BigInt(0), // Using 0 or generic sequence
                content: text,
                paste
            })
            console.log(`[Scrcpy] Clipboard PC -> Device (paste=${paste})`)
        } catch (error) {
            console.error('[Scrcpy] Set clipboard failed:', error)
        }
    }

    async setScreenPowerMode(mode: AndroidScreenPowerMode) {
        if (!this.active || !this.client?.controller) return
        try {
            await this.client.controller.setScreenPowerMode(mode)
            console.log(`[Scrcpy] Screen power mode set to ${mode}`)
        } catch (error) {
            console.error('[Scrcpy] Set screen power mode failed:', error)
        }
    }
}
