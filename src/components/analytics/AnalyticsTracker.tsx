import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAdbStore } from '@/stores/adbStore'
import { analytics } from '@/services/analytics'

/**
 * Componente per il tracciamento automatico delle visualizzazioni
 * e degli stati del programma.
 *
 * Gestisce:
 * - Inizializzazione sessione
 * - Page views su ogni cambio pagina (inclusa la homepage)
 * - Stato connessione dispositivo
 * - Click su link esterni
 */
export function AnalyticsTracker() {
    const currentPage = useAppStore((state) => state.currentPage)
    const isConnected = useAdbStore((state) => state.isConnected)
    const isDemoMode = useAdbStore((state) => state.isDemoMode)
    const sessionReady = useRef(false)
    const pendingPage = useRef<string | null>(null)

    // Inizializzazione sessione all'avvio
    useEffect(() => {
        analytics.initSession(isDemoMode).then((sessionId) => {
            sessionReady.current = !!sessionId

            // Traccia la pagina che era in attesa durante l'inizializzazione
            if (sessionId && pendingPage.current) {
                analytics.trackPageView(pendingPage.current, `Page: ${pendingPage.current}`)
                pendingPage.current = null
            }
        })
    }, [isDemoMode])

    // Tracciamento cambio pagina
    useEffect(() => {
        if (sessionReady.current) {
            // Sessione pronta, traccia subito
            analytics.trackPageView(currentPage, `Page: ${currentPage}`)
        } else {
            // Sessione non pronta, salva per dopo
            pendingPage.current = currentPage
        }
    }, [currentPage])

    // Tracciamento stato connessione dispositivo
    useEffect(() => {
        if (isConnected) {
            analytics.updateSessionFlags({ had_device_connected: true })
            analytics.trackEvent('device_connected')
        }
    }, [isConnected])

    // Tracciamento link in uscita
    useEffect(() => {
        const handleExitClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            const link = target.closest('a')
            if (link && link.href) {
                try {
                    const url = new URL(link.href)
                    if (url.hostname !== window.location.hostname) {
                        analytics.trackEvent('exit_click', { target_url: link.href })
                    }
                } catch {
                    // URL non valido, ignora
                }
            }
        }

        document.addEventListener('click', handleExitClick)
        return () => document.removeEventListener('click', handleExitClick)
    }, [])

    return null // Non renderizza nulla visivamente
}
