import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Analytics Service (Internal)
 * Traccia visite, eventi e performance in modo anonimo e sicuro.
 */

// Whitelist of allowed event names for security
const ALLOWED_EVENT_NAMES = [
    'device_connected',
    'device_disconnected',
    'package_disabled',
    'package_enabled',
    'package_uninstalled',
    'screen_mirror_start',
    'screen_mirror_stop',
    'degoogle_applied',
    'setting_changed',
    'page_view',
    'error',
    'demo_mode_activated',
    'apk_installed',
    'permission_changed',
    'exit_click',
] as const

type AllowedEventName = typeof ALLOWED_EVENT_NAMES[number]

export interface AnalyticsSession {
    id: string
    visitor_id: string
    country?: string
    region?: string
    city?: string
    user_agent: string
    browser: string
    os: string
    device_type: string
    referrer: string
    landing_page: string
    is_demo_mode: boolean
    had_device_connected: boolean
    ip_address?: string
}

class AnalyticsService {
    private sessionId: string | null = null
    private visitorId: string | null = null
    private pageStartTime: number = Date.now()
    private initialized: boolean = false
    private initPromise: Promise<string | null> | null = null

    constructor() {
        if (typeof window === 'undefined') return

        // Visitor ID persistente per riconoscere i ritorni (anonimo)
        this.visitorId = localStorage.getItem('adb_visitor_id')
        if (!this.visitorId) {
            this.visitorId = crypto.randomUUID()
            localStorage.setItem('adb_visitor_id', this.visitorId)
        }
    }

    /**
     * Inizializza la sessione di analytics
     */
    async initSession(isDemoMode: boolean = false) {
        if (this.initialized) return this.sessionId

        // Return existing promise if already initializing (prevent duplicate calls)
        if (this.initPromise) return this.initPromise

        // Skip analytics if Supabase is not properly configured
        if (!isSupabaseConfigured) {
            this.initialized = true
            return null
        }

        this.initPromise = this._doInitSession(isDemoMode)
        return this.initPromise
    }

    private async _doInitSession(isDemoMode: boolean): Promise<string | null> {
        this.initialized = true

        const userAgent = navigator.userAgent
        const referrer = document.referrer
        const landingPage = window.location.pathname

        const browser = this.getBrowser(userAgent)
        const os = this.getOS(userAgent)
        const deviceType = this.getDeviceType(userAgent)

        // Generiamo l'ID lato client per evitare la necessità di SELECT
        // dopo l'INSERT (gli utenti anonimi non hanno permessi SELECT)
        const clientSessionId = crypto.randomUUID()

        try {
            const { error } = await supabase
                .from('analytics_sessions')
                .insert({
                    id: clientSessionId,
                    visitor_id: this.visitorId,
                    user_agent: userAgent,
                    browser,
                    os,
                    device_type: deviceType,
                    referrer,
                    landing_page: landingPage,
                    is_demo_mode: isDemoMode
                })

            if (error) {
                this.initialized = false
                this.initPromise = null
                return null
            }
        } catch {
            this.initialized = false
            this.initPromise = null
            return null
        }

        this.sessionId = clientSessionId
        this.pageStartTime = Date.now()

        return this.sessionId
    }

    /**
     * Attende che la sessione sia inizializzata
     * Usato dall'AnalyticsTracker per evitare race conditions
     */
    async waitForSession(): Promise<string | null> {
        if (this.initPromise) {
            return this.initPromise
        }
        return this.sessionId
    }

    /**
     * Traccia una visualizzazione di pagina
     */
    async trackPageView(url: string, title: string) {
        if (!this.sessionId) return

        // Validate and sanitize inputs
        const sanitizedUrl = (url || '').slice(0, 500)
        const sanitizedTitle = (title || '').slice(0, 200)
        const sanitizedReferrer = (document.referrer || '').slice(0, 500)

        const now = Date.now()
        const durationSeconds = Math.round((now - this.pageStartTime) / 1000)

        // Validate duration is reasonable (max 24 hours)
        const validDuration = Math.min(Math.max(0, durationSeconds), 86400)

        // Usiamo una funzione RPC per atomicità e sicurezza
        const { error } = await supabase.rpc('track_page_view', {
            p_session_id: this.sessionId,
            p_url: sanitizedUrl,
            p_title: sanitizedTitle,
            p_referrer: sanitizedReferrer,
            p_duration: `${validDuration} seconds`
        })

        if (error) console.error('Track page view failed:', error)

        this.pageStartTime = now
    }

    /**
     * Traccia un evento personalizzato
     */
    async trackEvent(eventName: AllowedEventName, eventData: Record<string, unknown> = {}) {
        if (!this.sessionId) return

        // Validate event name against whitelist
        if (!ALLOWED_EVENT_NAMES.includes(eventName)) {
            console.warn(`Invalid event name: ${eventName}`)
            return
        }

        // Sanitize event data - limit size and depth
        const sanitizedData = this.sanitizeEventData(eventData)
        const sanitizedUrl = (window.location.pathname || '').slice(0, 500)

        const { error } = await supabase.rpc('track_event', {
            p_session_id: this.sessionId,
            p_event_name: eventName,
            p_event_data: sanitizedData,
            p_page_url: sanitizedUrl
        })

        if (error) console.error('Track event failed:', error)
    }

    /**
     * Sanitizza i dati dell'evento per prevenire injection e limitare dimensioni
     */
    private sanitizeEventData(data: Record<string, unknown>, maxDepth: number = 2): Record<string, unknown> {
        const sanitized: Record<string, unknown> = {}
        let keyCount = 0
        const maxKeys = 20

        for (const [key, value] of Object.entries(data)) {
            if (keyCount >= maxKeys) break

            // Validate key format
            const sanitizedKey = String(key).slice(0, 50).replace(/[^\w_-]/g, '_')

            if (value === null || value === undefined) {
                sanitized[sanitizedKey] = null
            } else if (typeof value === 'string') {
                sanitized[sanitizedKey] = value.slice(0, 500)
            } else if (typeof value === 'number') {
                sanitized[sanitizedKey] = Number.isFinite(value) ? value : 0
            } else if (typeof value === 'boolean') {
                sanitized[sanitizedKey] = value
            } else if (Array.isArray(value) && maxDepth > 0) {
                sanitized[sanitizedKey] = value.slice(0, 10).map(v =>
                    typeof v === 'string' ? v.slice(0, 100) :
                        typeof v === 'number' && Number.isFinite(v) ? v :
                            typeof v === 'boolean' ? v : null
                )
            } else if (typeof value === 'object' && maxDepth > 0) {
                sanitized[sanitizedKey] = this.sanitizeEventData(value as Record<string, unknown>, maxDepth - 1)
            }

            keyCount++
        }

        return sanitized
    }

    /**
     * Aggiorna i flag dello stato della sessione (es. dispositivo collegato)
     */
    async updateSessionFlags(flags: { is_demo_mode?: boolean, had_device_connected?: boolean }) {
        if (!this.sessionId) return

        const { error } = await supabase.rpc('track_session_flags', {
            p_session_id: this.sessionId,
            p_is_demo_mode: flags.is_demo_mode ?? null,
            p_had_device_connected: flags.had_device_connected ?? null
        })

        if (error) console.error('Update session flags failed:', error)
    }

    private getBrowser(ua: string) {
        if (ua.includes('Firefox')) return 'Firefox'
        if (ua.includes('SamsungBrowser')) return 'Samsung Browser'
        if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera'
        if (ua.includes('Edge')) return 'Edge'
        if (ua.includes('Chrome')) return 'Chrome'
        if (ua.includes('Safari')) return 'Safari'
        return 'Other'
    }

    private getOS(ua: string) {
        if (ua.includes('Windows')) return 'Windows'
        if (ua.includes('Mac OS')) return 'macOS'
        if (ua.includes('Android')) return 'Android'
        if (ua.includes('iOS')) return 'iOS'
        if (ua.includes('Linux')) return 'Linux'
        return 'Other'
    }

    private getDeviceType(ua: string) {
        if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
        if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(ua)) return 'mobile'
        return 'desktop'
    }
}

export const analytics = new AnalyticsService()
