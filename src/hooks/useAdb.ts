/**
 * useAdb Hook
 * Astrae le operazioni ADB e gestisce lo stato della connessione
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAdbStore } from '@/stores/adbStore'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import * as adbClient from '@/services/adb-client'
import {
  upsertDevice,
  getDeviceByFingerprint,
  generateDeviceFingerprint,
  uploadDiscoveredPackages,
  getReturnedPackages,
  logUserAction,
  getMobileAudits,
  createDebloatList
} from '@/services/supabase'

import { useTranslation } from '@/stores/i18nStore'
import {
  attemptDeviceAutoLogin,
  associateDevice
} from '@/services/device-auth'
import type { PackageDefinition } from '@/services/package-database'

export interface EnrichedPackage extends adbClient.PackageInfo {
  definition?: PackageDefinition
  readableName: string
}

const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest='
]

export function useAdb() {
  const {
    connectionStatus,
    isConnected,
    connectionError,
    deviceInfo,
    currentDeviceId,
    packages,
    packagesLoading,
    packagesError,
    setConnectionStatus,
    setConnectionError,
    setDeviceInfo,
    setCurrentDeviceId,
    setPackages,
    setPackagesLoading,
    setPackagesError,
    updatePackageStatus,
    addCommandLog,
    isDemoMode,
    setDemoMode,
    reset
  } = useAdbStore()

  const { showToast } = useAppStore()
  const { t } = useTranslation()
  useAuthStore() // For future use

  const reconnectAttempted = useRef(false)

  /**
   * Enter demo mode without a real device
   */
  const enterDemoMode = useCallback(async () => {
    reset()
    setDemoMode(true)
    setConnectionStatus('connected')

    // Import mock data dynamically or statically
    const { MOCK_DEVICE_INFO, MOCK_PACKAGES } = await import('@/services/mock-adb-data')

    setDeviceInfo(MOCK_DEVICE_INFO)
    setPackages(MOCK_PACKAGES)


    showToast({
      type: 'info',
      title: 'Demo Mode',
      message: 'You are now in demo mode. No commands will be sent to a real device.'
    })

    addCommandLog({
      command: 'demo-mode',
      result: 'success',
      message: 'Entered demo mode'
    })

    // Navigate to dashboard
    useAppStore.getState().setCurrentPage('dashboard')
  }, [reset, setDemoMode, setConnectionStatus, setDeviceInfo, setPackages, showToast, addCommandLog])


  /**
   * Check for new mobile audits
   */
  const checkMobileAudits = useCallback(async () => {
    const authStore = useAuthStore.getState()
    const {
      mobileAuditDetected,
      hasShownMobileAuditModal,
      setMobileAuditDetected,
      setCurrentMobileAudit,
      setHasShownMobileAuditModal
    } = useAdbStore.getState()

    if (authStore.isAuthenticated && authStore.user && !mobileAuditDetected && !hasShownMobileAuditModal) {
      try {
        // Fetch audits (already ordered by created_at desc in service)
        const audits = await getMobileAudits(authStore.user.id)
        if (audits && audits.length > 0) {
          // Find the most recent unexecuted audit
          const latestAudit = audits.find(a => !a.is_executed)
          if (latestAudit) {
            setCurrentMobileAudit(latestAudit)
            setMobileAuditDetected(true)
            setHasShownMobileAuditModal(false)
          }
        }
      } catch (error) {
        console.warn('Error checking mobile audits:', error)
      }
    }
  }, [])

  /**
   * Creates a community list from a mobile audit
   */
  const createCommunityListFromAudit = useCallback(async (auditId: string): Promise<boolean> => {
    const authStore = useAuthStore.getState()
    const { currentMobileAudit } = useAdbStore.getState()

    if (!authStore.isAuthenticated || !authStore.user || !currentMobileAudit || currentMobileAudit.id !== auditId) {
      return false
    }

    try {
      const nickname = authStore.user.user_metadata?.nickname || authStore.user.email?.split('@')[0] || 'Anonymous'
      const title = `${currentMobileAudit.device_model} Audit`
      const description = `Imported from ADB Zero Companion on ${currentMobileAudit.device_model}`

      // manifest_data: { device: { manufacturer, model }, audit_results: [ { package_id, app_name, removal_level, recommendation ... } ] }
      const auditData = currentMobileAudit.manifest_data
      const items = auditData.audit_results
        .filter((r: any) => r.recommendation === 'debloat')
        .map((r: any) => ({
          package_name: r.package_id,
          label: r.app_name || '',
          description: r.reasons?.join(', ') || '',
          level: (r.removal_level || 'Recommended') as any
        }))

      if (items.length === 0) {
        showToast({
          type: 'info',
          title: t('common.info'),
          message: 'No packages recommended for debloating in this audit.'
        })
        return false
      }

      await createDebloatList(
        authStore.user.id,
        nickname,
        title,
        description,
        true, // isPublic
        items,
        currentMobileAudit.device_model,
        auditData.device?.manufacturer
      )

      showToast({
        type: 'success',
        title: t('community.title'),
        message: 'Community list created successfully from your mobile audit!'
      })

      return true
    } catch (error) {
      console.error('Failed to create community list from audit:', error)
      showToast({
        type: 'error',
        title: t('common.error'),
        message: 'Failed to create community list.'
      })
      return false
    }
  }, [t, showToast])

  // Initialize and check for previously authorized devices
  useEffect(() => {
    const init = async () => {
      await adbClient.initializeAdbManager()

      // Try to reconnect to a previously authorized device
      if (!reconnectAttempted.current && !isConnected) {
        reconnectAttempted.current = true
        const devices = await adbClient.getAuthorizedDevices()
        if (devices.length > 0) {
          // Found a previously authorized device, try to reconnect
          console.log(t('adb.reconnecting'))
        }
      }

      // Check for mobile audits on init
      checkMobileAudits()
    }

    init()

    // Periodically check for mobile audits (every 30 seconds)
    const interval = setInterval(checkMobileAudits, 30000)
    return () => clearInterval(interval)
  }, [isConnected, t, checkMobileAudits])

  /**
   * Registra il dispositivo su Supabase e ottiene l'ID
   */
  const registerDevice = useCallback(async (info: adbClient.DeviceInfo): Promise<string | null> => {
    try {
      const fingerprint = generateDeviceFingerprint(
        info.manufacturer,
        info.model,
        info.serialNumber
      )

      // Ottieni il dispositivo esistente per controllare se la versione è cambiata
      const existingDevice = await getDeviceByFingerprint(fingerprint)
      const currentApiLevel = parseInt(info.apiLevel) || null

      const device = await upsertDevice({
        manufacturer: info.manufacturer,
        model: info.model,
        android_version: info.androidVersion,
        api_level: currentApiLevel,
        fingerprint
      })

      // Se l'utente è loggato, controlla se ci sono pacchetti ritornati
      const authStore = useAuthStore.getState()
      if (authStore.isAuthenticated && authStore.user && device.id) {
        // Recupera i pacchetti attualmente abilitati sul dispositivo
        const currentPackages = await adbClient.listPackages()
        const enabledPackageNames = currentPackages
          .filter(p => p.isEnabled)
          .map(p => p.packageName)

        const returned = await getReturnedPackages(authStore.user.id, device.id, enabledPackageNames)

        if (returned.length > 0) {
          const { setSystemUpdateDetected, setReturnedPackages, setHasShownUpdateModal } = useAdbStore.getState()
          setReturnedPackages(returned)

          // Mostra il modal automaticamente SOLO se la versione è cambiata (Aggiornamento Sistema)
          if (existingDevice && existingDevice.api_level !== null && currentApiLevel !== null && currentApiLevel > existingDevice.api_level) {
            setSystemUpdateDetected(true)
            setHasShownUpdateModal(false)
          }
        }
      }

      return device.id
    } catch (error) {
      console.warn('Errore registrazione dispositivo:', error)
      return null
    }
  }, [])

  /**
   * Upload pacchetti scoperti alla community database
   */
  const uploadPackagesToCommunity = useCallback(async (
    pkgs: adbClient.PackageInfo[]
  ) => {
    try {
      const packagesToUpload = pkgs.map(pkg => ({
        package_name: pkg.packageName
      }))

      await uploadDiscoveredPackages(packagesToUpload)
      console.log(`Uploaded ${packagesToUpload.length} packages to community database`)
    } catch (error) {
      console.warn('Errore upload pacchetti community:', error)
    }
  }, [])

  /**
   * Connette a un dispositivo via USB picker
   */
  const connect = useCallback(async () => {
    setConnectionStatus('connecting')
    setConnectionError(null)

    const authStore = useAuthStore.getState()

    try {
      const adb = await adbClient.connectDevice((status) => {
        setConnectionStatus(status)
      })

      if (!adb) {
        setConnectionStatus('disconnected')
        return false
      }

      setConnectionStatus('connected')

      // Fetch device info
      const info = await adbClient.getDeviceInfo()
      setDeviceInfo(info)

      // Generate fingerprint for this device
      const fingerprint = generateDeviceFingerprint(
        info.manufacturer,
        info.model,
        info.serialNumber
      )

      // Tenta auto-login se l'utente non è già loggato
      if (!authStore.isAuthenticated) {
        const autoLoginUserId = await attemptDeviceAutoLogin(info.serialNumber, fingerprint)
        if (autoLoginUserId) {
          console.log(t('adb.autoLoginDetected'))
          // Carica la sessione utente esistente
          await authStore.initialize()

          if (authStore.isAuthenticated) {
            showToast({
              type: 'success',
              title: t('adb.welcomeBack'),
              message: t('adb.autoLoginSuccess', { model: info.model })
            })
          }
        }
      }

      // Se l'utente è loggato (dopo init o già prima), associa il dispositivo
      if (authStore.isAuthenticated && authStore.user) {
        associateDevice(authStore.user.id, {
          serial: info.serialNumber,
          fingerprint,
          model: info.model,
          manufacturer: info.manufacturer
        }).catch(err => console.warn('Errore associazione dispositivo:', err))
      }

      // Register device on Supabase (async, don't wait)
      registerDevice(info).then(deviceId => {
        if (deviceId) {
          setCurrentDeviceId(deviceId)
        }
      })

      showToast({
        type: 'success',
        title: t('adb.connected'),
        message: t('adb.connectedTo', { model: info.model })
      })

      addCommandLog({
        command: 'connect',
        result: 'success',
        message: t('adb.connectedTo', { model: info.model })
      })

      // Navigate to dashboard
      useAppStore.getState().setCurrentPage('dashboard')

      return true
    } catch (error) {
      const errorMessage = getErrorMessage(error, t)
      setConnectionStatus('error')
      setConnectionError(errorMessage)

      showToast({
        type: 'error',
        title: t('adb.connectionError'),
        message: errorMessage
      })

      addCommandLog({
        command: 'connect',
        result: 'error',
        message: errorMessage
      })

      return false
    }
  }, [setConnectionStatus, setConnectionError, setDeviceInfo, setCurrentDeviceId, showToast, addCommandLog, registerDevice, t])

  /**
   * Disconnette il dispositivo
   */
  const disconnect = useCallback(async () => {
    try {
      await adbClient.disconnectDevice()
      reset()

      showToast({
        type: 'info',
        title: t('adb.disconnected'),
        message: t('adb.deviceDisconnected')
      })

      useAppStore.getState().setCurrentPage('connect')
    } catch (error) {
      console.error('Errore disconnessione:', error)
    }
  }, [reset, showToast, t])

  const shell = useCallback(async (command: string): Promise<adbClient.ShellResult> => {
    if (isDemoMode) {
      console.log(`[DEMO] Executing shell: ${command}`)

      const result = {
        exitCode: 0,
        stdout: 'Success (Demo Mode)',
        stderr: ''
      }

      addCommandLog({
        command,
        result: 'success',
        message: result.stdout
      })

      return result
    }

    try {
      const result = await adbClient.shell(command)
      // addCommandLog rimosso: gestito dal listener globale per trasparenza totale
      return result
    } catch (error) {
      // addCommandLog rimosso: gli errori sono loggati dal listener se arrivano da adbClient.shell
      throw error
    }
  }, [addCommandLog, t])

  /**
   * Carica la lista dei pacchetti
   */
  const loadPackages = useCallback(async () => {
    if (!isConnected) return
    if (isDemoMode) return // Don't reload if in demo mode (mock data is static)

    setPackagesLoading(true)
    setPackagesError(null)

    try {
      const pkgs = await adbClient.listPackages()
      setPackages(pkgs)

      if (currentDeviceId) {
        uploadPackagesToCommunity(pkgs)
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, t)
      setPackagesError(errorMessage)

      showToast({
        type: 'error',
        title: t('dashboard.packagesError'),
        message: errorMessage
      })
    } finally {
      setPackagesLoading(false)
    }
  }, [isConnected, currentDeviceId, setPackagesLoading, setPackagesError, setPackages, showToast, uploadPackagesToCommunity, t])

  /**
   * Abilita/Disabilita un pacchetto
   * Gestisce automaticamente il fallback da disable-user a uninstall se necessario
   */
  const togglePackage = useCallback(async (
    packageName: string,
    enable: boolean
  ): Promise<boolean> => {
    if (isDemoMode) {
      const actualCommand = enable
        ? `pm enable ${packageName}`
        : `pm disable-user --user 0 ${packageName}`

      addCommandLog({
        command: actualCommand,
        result: 'success',
        message: 'Success (Demo Mode)'
      })

      updatePackageStatus(packageName, enable)

      showToast({
        type: 'success',
        title: enable ? t('adb.package.enabled') : t('adb.package.removed'),
        message: `${packageName} (Demo Mode)`
      })

      return true
    }

    try {
      const result = enable
        ? await adbClient.enablePackage(packageName)
        : await adbClient.disablePackage(packageName)

      // Controlla se è stato usato il fallback (uninstall o install-existing)
      const usedFallback = result.stdout.includes('[Fallback') || result.stdout.includes('[Reinstallato')

      // Determina se il comando ha avuto successo
      // Success indicators: "new state", "Success", "[Fallback", "[Reinstallato", "installed"
      const isSuccess = result.exitCode === 0 ||
        result.stdout.includes('new state') ||
        result.stdout.includes('Success') ||
        result.stdout.includes('[Fallback') ||
        result.stdout.includes('[Reinstallato') ||
        result.stdout.includes('installed')

      // addCommandLog rimosso: adbClient.enablePackage/disablePackage 
      // chiamano shell() che viene loggato automaticamente

      if (isSuccess) {
        updatePackageStatus(packageName, enable)

        // Log action if authenticated (incrementa anche stats nel DB)
        const authStore = useAuthStore.getState()
        if (authStore.isAuthenticated && authStore.user && currentDeviceId) {
          logUserAction(
            authStore.user.id,
            currentDeviceId,
            packageName,
            enable ? 'enable' : 'disable'
          ).catch(e => console.warn('Failed to log action:', e))
        }

        // Messaggio più informativo se è stato usato il fallback
        const toastMessage = usedFallback
          ? `${packageName} ${t('adb.package.alternativeMethod')}`
          : packageName

        showToast({
          type: 'success',
          title: enable ? t('adb.package.enabled') : t('adb.package.removed'),
          message: toastMessage
        })

        return true
      } else {
        throw new Error(result.stderr || result.stdout || t('adb.shell.error'))
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, t)

      // addCommandLog rimosso: gestito dal listener

      showToast({
        type: 'error',
        title: t('common.error'),
        message: getDeviceQuirksSuggestion(errorMessage, t)
      })

      return false
    }
  }, [updatePackageStatus, showToast, addCommandLog, t, currentDeviceId])

  /**
   * Aggiorna info dispositivo
   */
  const refreshDeviceInfo = useCallback(async () => {
    if (!isConnected) return

    try {
      const info = await adbClient.getDeviceInfo()
      setDeviceInfo(info)
    } catch (error) {
      console.error('Errore refresh info:', error)
    }
  }, [isConnected, setDeviceInfo])

  /**
   * Cambia risoluzione schermo
   */
  const setResolution = useCallback(async (width: number, height: number): Promise<boolean> => {
    if (isDemoMode) {
      if (deviceInfo) {
        setDeviceInfo({ ...deviceInfo, screenResolution: `${width}x${height}` })
      }
      showToast({
        type: 'success',
        title: t('adb.tools.resolutionChanged'),
        message: `${width}x${height} (Demo Mode)`
      })
      return true
    }
    try {
      const result = await adbClient.setScreenResolution(width, height)

      if (result.exitCode === 0) {
        await refreshDeviceInfo()

        showToast({
          type: 'success',
          title: t('adb.tools.resolutionChanged'),
          message: `${width}x${height}`
        })

        return true
      }

      throw new Error(result.stderr || t('adb.shell.error'))
    } catch (error) {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: getErrorMessage(error, t)
      })

      return false
    }
  }, [refreshDeviceInfo, showToast, t])

  /**
   * Cambia densità schermo
   */
  const setDensity = useCallback(async (density: number): Promise<boolean> => {
    if (isDemoMode) {
      if (deviceInfo) {
        setDeviceInfo({ ...deviceInfo, screenDensity: `${density}` })
      }
      showToast({
        type: 'success',
        title: t('adb.tools.densityChanged'),
        message: `${density} DPI (Demo Mode)`
      })
      return true
    }
    try {
      const result = await adbClient.setScreenDensity(density)

      if (result.exitCode === 0) {
        await refreshDeviceInfo()

        showToast({
          type: 'success',
          title: t('adb.tools.densityChanged'),
          message: `${density} DPI`
        })

        return true
      }

      throw new Error(result.stderr || t('adb.shell.error'))
    } catch (error) {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: getErrorMessage(error, t)
      })

      return false
    }
  }, [refreshDeviceInfo, showToast, t])

  /**
   * Reset impostazioni schermo
   */
  const resetScreen = useCallback(async (): Promise<boolean> => {
    if (isDemoMode) {
      const { MOCK_DEVICE_INFO } = await import('@/services/mock-adb-data')
      if (deviceInfo) {
        setDeviceInfo({
          ...deviceInfo,
          screenResolution: MOCK_DEVICE_INFO.screenResolution,
          screenDensity: MOCK_DEVICE_INFO.screenDensity
        })
      }
      showToast({
        type: 'success',
        title: t('adb.tools.resetComplete'),
        message: t('adb.tools.screenRestored')
      })
      return true
    }
    try {
      await adbClient.resetScreenSettings()
      await refreshDeviceInfo()

      showToast({
        type: 'success',
        title: t('adb.tools.resetComplete'),
        message: t('adb.tools.screenRestored')
      })

      return true
    } catch (error) {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: getErrorMessage(error, t)
      })

      return false
    }
  }, [refreshDeviceInfo, showToast, t])

  /**
   * Scarica e installa un APK da un URL
   */
  const installRemoteApk = useCallback(async (
    url: string,
    packageName: string,
    onProgress?: (p: number) => void
  ): Promise<boolean> => {
    if (isDemoMode) {
      addCommandLog({
        command: `install ${packageName} from ${url}`,
        result: 'success',
        message: 'Success (Demo Mode)'
      })
      return true
    }

    try {
      addCommandLog({
        command: `download ${url}`,
        result: 'pending',
        message: t('adb.install.loading')
      })

      // 1. Scarica l'APK
      // Prova fetch diretto, se fallisce prova via proxy
      let response: Response | null = null
      let error: any = null

      try {
        response = await fetch(url)
      } catch (e) {
        error = e
      }

      if (!response || !response.ok) {
        console.log('Direct fetch failed, trying proxies...')
        for (const proxy of CORS_PROXIES) {
          try {
            response = await fetch(proxy + encodeURIComponent(url))
            if (response.ok) {
              console.log(`Success with proxy: ${proxy}`)
              break
            }
          } catch {
            continue
          }
        }
      }

      if (!response || !response.ok) {
        // Se non è un APK ma una pagina web, diamo un suggerimento migliore
        if (url.includes('f-droid.org/packages') || url.includes('github.com') && !url.includes('.apk')) {
          throw new Error('URL non valido: sembra una pagina web e non un file APK diretto. Gli amministratori devono fornire un link diretto al file .apk.')
        }
        throw new Error(error || `HTTP error! status: ${response?.status}`)
      }

      // Check content type
      const contentType = response.headers.get('Content-Type')
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Il link fornito porta a una pagina HTML, non a un file APK. Usa un link diretto al download.')
      }

      const contentLength = +(response.headers.get('Content-Length') || 0)
      const reader = response.body!.getReader()
      let receivedLength = 0
      const chunks = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        receivedLength += value.length
        if (contentLength) {
          onProgress?.((receivedLength / contentLength) * 0.4) // 40% for download
        }
      }

      const blob = new Uint8Array(receivedLength)
      let position = 0
      for (let chunk of chunks) {
        blob.set(chunk, position)
        position += chunk.length
      }

      addCommandLog({
        command: `download ${url}`,
        result: 'success',
        message: t('adb.install.downloadComplete')
      })

      addCommandLog({
        command: `pm install ${packageName}`,
        result: 'pending',
        message: t('adb.install.pushing')
      })

      // 2. Installa via ADB
      const result = await adbClient.installApk(blob, (p) => {
        onProgress?.(0.4 + (p * 0.6)) // 60% for upload/install
      })

      if (result.exitCode === 0 || result.stdout.includes('Success')) {
        // addCommandLog rimosso: pm install loggato da shell()

        showToast({
          type: 'success',
          title: t('adb.install.complete'),
          message: packageName
        })
        return true
      } else {
        throw new Error(result.stderr || result.stdout)
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, t)

      addCommandLog({
        command: `install ${packageName}`,
        result: 'error',
        message: errorMessage
      })

      showToast({
        type: 'error',
        title: t('adb.install.error'),
        message: errorMessage
      })
      return false
    }
  }, [isDemoMode, addCommandLog, showToast, t])

  /**
   * Disinstalla completamente un pacchetto usando Root
   */
  const uninstallRoot = useCallback(async (packageName: string): Promise<boolean> => {
    if (isDemoMode) {
      addCommandLog({
        command: `su -c "rm -rf ${packageName}"`,
        result: 'success',
        message: 'Success (Demo Mode)'
      })
      updatePackageStatus(packageName, false)
      showToast({
        type: 'success',
        title: t('adb.package.removed'),
        message: `${packageName} (Root Demo)`
      })
      return true
    }

    const pkg = packages.find(p => p.packageName === packageName)
    if (!pkg || !pkg.apkPath) {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: 'Package info not found'
      })
      return false
    }

    const result = await adbClient.uninstallPackageRoot(packageName, pkg.apkPath)
    // addCommandLog rimosso: uninstallPackageRoot esegue diverse shell() loggate automaticamente

    if (result.exitCode === 0) {
      updatePackageStatus(packageName, false)

      // Log action if authenticated
      const authStore = useAuthStore.getState()
      if (authStore.isAuthenticated && authStore.user && currentDeviceId) {
        logUserAction(
          authStore.user.id,
          currentDeviceId,
          packageName,
          'uninstall'
        ).catch(e => console.warn('Failed to log action:', e))
      }

      showToast({
        type: 'success',
        title: t('adb.package.removed'),
        message: `${packageName} (Root)`
      })
      return true
    } else {
      showToast({
        type: 'error',
        title: t('adb.shell.error'),
        message: result.stderr || result.stdout
      })
      return false
    }
    return result.exitCode === 0
  }, [packages, isDemoMode, addCommandLog, updatePackageStatus, showToast, t, currentDeviceId])

  /**
   * Ottiene la lista degli utenti
   */
  const loadUsers = useCallback(async (): Promise<adbClient.UserInfo[]> => {
    if (isDemoMode) {
      return [
        { id: 0, name: 'Owner', flags: 13, isManaged: false, isRunning: true },
        { id: 10, name: 'ClonedApps', flags: 30, isManaged: true, isRunning: true }
      ]
    }
    return await adbClient.listUsers()
  }, [isDemoMode])

  /**
   * Crea e configura un profilo clonato
   */
  const createCloneProfile = useCallback(async (
    name: string,
    onProgress?: adbClient.SetupProgressCallback
  ): Promise<number | null> => {
    if (isDemoMode) {
      showToast({ type: 'success', title: 'Profile Created (Demo)', message: name })
      return 10
    }

    try {
      onProgress?.({
        phase: 'settings',
        message: 'Creating managed profile...',
      })
      const userId = await adbClient.createManagedProfile(name)
      if (userId) {
        onProgress?.({
          phase: 'settings',
          message: 'Starting user process...',
        })
        await adbClient.startUser(userId)
        const { success, debloatStats } = await adbClient.setupManagedProfile(userId, onProgress)

        if (success) {
          const statsMsg = `ID: ${userId} — ${debloatStats.removed} ${t('appCloner.packagesRemoved')}, ${debloatStats.kept} ${t('appCloner.packagesKept')}`
          showToast({
            type: 'success',
            title: t('appCloner.profileCreated'),
            message: statsMsg
          })
        } else {
          showToast({
            type: 'warning',
            title: t('appCloner.profileCreated'),
            message: `ID: ${userId} — ${t('appCloner.setupPartialWarning')}`
          })
        }

        return userId
      }
      return null
    } catch (error) {
      showToast({ type: 'error', title: t('common.error'), message: getErrorMessage(error, t) })
      return null
    }
  }, [isDemoMode, showToast, t])

  /**
   * Rimuove un profilo
   */
  const deleteUserProfile = useCallback(async (userId: number): Promise<boolean> => {
    if (isDemoMode) {
      showToast({ type: 'success', title: 'Profile Deleted (Demo)', message: `ID: ${userId}` })
      return true
    }

    try {
      const success = await adbClient.removeUser(userId)
      if (success) {
        showToast({ type: 'success', title: t('appCloner.profileDeleted') })
      }
      return success
    } catch (error) {
      showToast({ type: 'error', title: t('common.error'), message: getErrorMessage(error, t) })
      return false
    }
  }, [isDemoMode, showToast, t])

  /**
   * Clona un'app in un profilo specifico
   */
  const cloneAppToUser = useCallback(async (packageName: string, userId: number): Promise<boolean> => {
    if (isDemoMode) {
      showToast({ type: 'success', title: 'App Cloned (Demo)', message: `${packageName} -> ${userId}` })
      return true
    }

    try {
      const success = await adbClient.installExistingForUser(packageName, userId)
      if (success) {
        showToast({ type: 'success', title: t('appCloner.appCloned'), message: packageName })
      }
      return success
    } catch (error) {
      showToast({ type: 'error', title: t('common.error'), message: getErrorMessage(error, t) })
      return false
    }
  }, [isDemoMode, showToast, t])

  return {
    // State
    connectionStatus,
    isConnected,
    connectionError,
    deviceInfo,
    currentDeviceId,
    packages,
    packagesLoading,
    packagesError,

    isDemoMode,
    enterDemoMode,
    connect,
    disconnect,
    shell,
    loadPackages,
    togglePackage,
    refreshDeviceInfo,
    setResolution,
    setDensity,
    resetScreen,
    installRemoteApk,
    uninstallRoot,
    loadUsers,
    createCloneProfile,
    deleteUserProfile,
    cloneAppToUser,
    createCommunityListFromAudit
  }
}

// ... existing code ...

/**
 * Estrae un messaggio di errore leggibile
 */
function getErrorMessage(error: unknown, t: any): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()

    // Handle WebUSB / secure context errors
    if (error.message === 'HTTPS_REQUIRED') {
      return t('adb.errors.httpsRequired')
    }
    if (error.message === 'WEBUSB_NOT_SUPPORTED') {
      return t('adb.errors.webUsbNotSupported')
    }
    if (error.message === 'ADB_INIT_FAILED') {
      return t('adb.errors.adbInitFailed')
    }

    // Handle specific ADB errors
    if (msg.includes('no device selected')) {
      return t('adb.errors.noDevice')
    }

    // Device in use by ADB server or another program
    if (msg.includes('already in use') ||
      msg.includes('unable to claim interface') ||
      msg.includes('claim interface') ||
      msg.includes('interface already claimed')) {
      return t('adb.errors.deviceBusy')
    }

    if (msg.includes('access denied')) {
      return t('adb.errors.accessDenied')
    }

    if (msg.includes('device not found') || msg.includes('no device')) {
      return t('adb.errors.deviceNotFound')
    }

    if (msg.includes('network') || msg.includes('offline')) {
      return t('adb.errors.deviceOffline')
    }

    return error.message
  }
  return t('adb.errors.unknown')
}

/**
 * Suggerimenti per problemi specifici di alcuni produttori
 */
function getDeviceQuirksSuggestion(errorMessage: string, t: any): string {
  const suggestions: string[] = []
  const lowerMsg = errorMessage.toLowerCase()

  if (lowerMsg.includes('security') || lowerMsg.includes('permission')) {
    suggestions.push(t('adb.suggestions.security'))
  }

  if (lowerMsg.includes('cannot disable') || lowerMsg.includes('securityexception')) {
    suggestions.push(t('adb.suggestions.disableBlocked'))
  }

  if (lowerMsg.includes('not found') || lowerMsg.includes('unknown package')) {
    suggestions.push(t('adb.suggestions.packageNotFound'))
  }

  return suggestions.length > 0
    ? `${errorMessage}\n\n💡 ${suggestions.join('\n')}`
    : errorMessage
}
