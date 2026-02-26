import { useEffect } from 'react'
import { useAdbStore } from '@/stores/adbStore'
import * as adbClient from '@/services/adb-client'

/**
 * Hook globale per intercettare tutti i comandi ADB e loggarli nel terminale.
 * Deve essere chiamato una sola volta nel root dell'applicazione (es. App.tsx).
 */
export function useAdbInterceptor() {
    const addCommandLog = useAdbStore(state => state.addCommandLog)

    useEffect(() => {
        const listener: adbClient.CommandListener = (command, result) => {
            // Non loggare se siamo in demo mode (il log viene gestito manualmente per coerenza)
            if (useAdbStore.getState().isDemoMode) return

            addCommandLog({
                command,
                result: result.exitCode === 0 ? 'success' : 'error',
                message: [result.stdout, result.stderr].filter(s => s && s.trim()).join('\n') || undefined
            })
        }

        adbClient.addCommandListener(listener)
        return () => adbClient.removeCommandListener(listener)
    }, [addCommandLog])
}
