/**
 * ADB Store
 * Gestisce lo stato della connessione ADB e le informazioni del dispositivo
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DeviceInfo, PackageInfo } from '@/services/adb-client'
import type { MobileAudit } from '@/services/supabase'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'authorizing' | 'connected' | 'error'

interface AdbState {
  // Connection state
  connectionStatus: ConnectionStatus
  isConnected: boolean
  connectionError: string | null

  // Device info
  deviceInfo: DeviceInfo | null
  currentDeviceId: string | null // Supabase device ID

  // Packages
  packages: PackageInfo[]
  packagesLoading: boolean
  packagesError: string | null

  // Logs
  commandLogs: CommandLog[]
  totalCommands: number

  // Demo mode
  isDemoMode: boolean

  // Sync / Update state
  systemUpdateDetected: boolean
  returnedPackages: string[]
  hasShownUpdateModal: boolean // To show it only once per session/connection

  // Mobile Bridge state
  mobileAuditDetected: boolean
  currentMobileAudit: MobileAudit | null
  hasShownMobileAuditModal: boolean

  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void
  setConnectionError: (error: string | null) => void
  setDeviceInfo: (info: DeviceInfo | null) => void
  setCurrentDeviceId: (id: string | null) => void
  setPackages: (packages: PackageInfo[]) => void
  setPackagesLoading: (loading: boolean) => void
  setPackagesError: (error: string | null) => void
  updatePackageStatus: (packageName: string, isEnabled: boolean) => void
  addCommandLog: (log: Omit<CommandLog, 'id' | 'timestamp'>) => void
  setDemoMode: (isDemoMode: boolean) => void
  setSystemUpdateDetected: (detected: boolean) => void
  setReturnedPackages: (packages: string[]) => void
  setHasShownUpdateModal: (shown: boolean) => void
  setMobileAuditDetected: (detected: boolean) => void
  setCurrentMobileAudit: (audit: MobileAudit | null) => void
  setHasShownMobileAuditModal: (shown: boolean) => void
  clearLogs: () => void
  downloadFullLog: () => void
  reset: () => void
}

interface CommandLog {
  id: string
  timestamp: Date
  command: string
  result: 'success' | 'error' | 'pending'
  message?: string
}

const initialState = {
  connectionStatus: 'disconnected' as ConnectionStatus,
  isConnected: false,
  connectionError: null,
  deviceInfo: null,
  currentDeviceId: null,
  packages: [],
  packagesLoading: false,
  packagesError: null,
  commandLogs: [],
  totalCommands: 0,
  isDemoMode: false,
  systemUpdateDetected: false,
  returnedPackages: [],
  hasShownUpdateModal: false,
  mobileAuditDetected: false,
  currentMobileAudit: null,
  hasShownMobileAuditModal: false,
}

export const useAdbStore = create<AdbState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setConnectionStatus: (status) => set({
        connectionStatus: status,
        isConnected: status === 'connected',
        connectionError: status === 'error' ? get().connectionError : null
      }),

      setConnectionError: (error) => set({
        connectionError: error,
        connectionStatus: error ? 'error' : get().connectionStatus
      }),

      setDeviceInfo: (info) => set({ deviceInfo: info }),

      setCurrentDeviceId: (id) => set({ currentDeviceId: id }),

      setPackages: (packages) => set({
        packages,
        packagesError: null
      }),

      setPackagesLoading: (loading) => set({ packagesLoading: loading }),

      setPackagesError: (error) => set({ packagesError: error }),

      updatePackageStatus: (packageName, isEnabled) => set((state) => ({
        packages: state.packages.map(pkg =>
          pkg.packageName === packageName
            ? { ...pkg, isEnabled }
            : pkg
        )
      })),

      addCommandLog: (log) => set((state) => ({
        totalCommands: state.totalCommands + 1,
        commandLogs: [
          {
            ...log,
            id: crypto.randomUUID(),
            timestamp: new Date()
          },
          ...state.commandLogs
        ] // NO LIMIT - User wants to consult everything
      })),

      setDemoMode: (isDemoMode) => set({ isDemoMode }),

      setSystemUpdateDetected: (detected) => set({ systemUpdateDetected: detected }),

      setReturnedPackages: (packages) => set({ returnedPackages: packages }),

      setHasShownUpdateModal: (shown) => set({ hasShownUpdateModal: shown }),

      setMobileAuditDetected: (detected) => set({ mobileAuditDetected: detected }),

      setCurrentMobileAudit: (audit) => set({ currentMobileAudit: audit }),

      setHasShownMobileAuditModal: (shown) => set({ hasShownMobileAuditModal: shown }),

      clearLogs: () => set({ commandLogs: [], totalCommands: 0 }),

      downloadFullLog: () => {
        const state = get()
        const logs = state.commandLogs.slice().reverse()
        const content = logs.map(l => {
          const time = l.timestamp.toLocaleTimeString()
          return `[${time}] ${l.command}\n${l.message ? `${l.message}\n` : ''}\n-------------------\n`
        }).join('\n')

        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `adb_session_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
        a.click()
        URL.revokeObjectURL(url)
      },

      reset: () => set({
        ...initialState,
        commandLogs: [], // Clear on logout/disconnect as requested
        totalCommands: 0,
        systemUpdateDetected: false,
        returnedPackages: [],
        hasShownUpdateModal: false,
        mobileAuditDetected: false,
        currentMobileAudit: null,
        hasShownMobileAuditModal: false
      })
    }),
    {
      name: 'adbloater-adb-store',
      version: 2,
      partialize: (state) => ({
        // Persist only lightweight flags. Logs stay in-memory to avoid localStorage quota overflow.
        isDemoMode: state.isDemoMode
      })
    }
  )
)
