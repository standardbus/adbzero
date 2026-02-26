/**
 * useUadSync Hook
 * Gestisce la sincronizzazione automatica del database UAD
 */

import { useEffect, useRef } from 'react'
import { getPackageDatabase, refreshPackageDatabase } from '@/services/package-database'
import { useAppStore } from '@/stores/appStore'

// Chiave per tracciare l'ultimo sync in localStorage
const LAST_SYNC_KEY = 'adbloater_uad_last_sync'
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 ore

/**
 * Hook per sincronizzare automaticamente il database UAD
 * - All'avvio dell'app, controlla se è passato più di 24 ore dall'ultimo sync
 * - Se sì, scarica il database aggiornato in background
 */
export function useUadSync() {
  const showToast = useAppStore((state) => state.showToast)
  const syncAttempted = useRef(false)

  useEffect(() => {
    if (syncAttempted.current) return
    syncAttempted.current = true

    const checkAndSync = async () => {
      try {
        const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY)
        const lastSync = lastSyncStr ? parseInt(lastSyncStr) : 0
        const now = Date.now()
        
        // Controlla se è passato abbastanza tempo dall'ultimo sync
        if (now - lastSync > SYNC_INTERVAL_MS) {
          console.log('🔄 Avvio sync automatico database UAD...')
          
          // Prima carica dalla cache per UI immediata
          await getPackageDatabase()
          
          // Poi aggiorna in background
          const db = await refreshPackageDatabase()
          
          // Aggiorna timestamp ultimo sync
          localStorage.setItem(LAST_SYNC_KEY, String(now))
          
          console.log(`✅ Database UAD sincronizzato: ${Object.keys(db.packages).length} pacchetti`)
        } else {
          // Usa la cache esistente
          const db = await getPackageDatabase()
          console.log(`📦 Database UAD dalla cache: ${Object.keys(db.packages).length} pacchetti`)
        }
      } catch (error) {
        console.warn('⚠️ Sync UAD fallito, utilizzo cache locale:', error)
        
        // Prova comunque a caricare dalla cache
        try {
          await getPackageDatabase()
        } catch {
          // Ignora - useremo un database vuoto
        }
      }
    }

    // Esegui subito
    checkAndSync()
    
    // Imposta un check periodico (ogni ora controlla se serve sync)
    const intervalId = setInterval(() => {
      const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY)
      const lastSync = lastSyncStr ? parseInt(lastSyncStr) : 0
      
      if (Date.now() - lastSync > SYNC_INTERVAL_MS) {
        refreshPackageDatabase().then(() => {
          localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
          console.log('🔄 Database UAD aggiornato automaticamente')
        }).catch(() => {
          // Silently fail - non critico
        })
      }
    }, 60 * 60 * 1000) // Ogni ora
    
    return () => clearInterval(intervalId)
  }, [showToast])
}

/**
 * Forza un refresh manuale del database
 */
export async function forceUadSync(): Promise<{ success: boolean; count: number }> {
  try {
    const db = await refreshPackageDatabase()
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
    return { success: true, count: Object.keys(db.packages).length }
  } catch (error) {
    console.error('Errore sync UAD:', error)
    return { success: false, count: 0 }
  }
}

/**
 * Ottiene info sull'ultimo sync
 */
export function getLastSyncInfo(): { timestamp: Date | null; isStale: boolean } {
  const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY)
  
  if (!lastSyncStr) {
    return { timestamp: null, isStale: true }
  }
  
  const lastSync = parseInt(lastSyncStr)
  const isStale = Date.now() - lastSync > SYNC_INTERVAL_MS
  
  return {
    timestamp: new Date(lastSync),
    isStale
  }
}

