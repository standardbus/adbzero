/**
 * Debloater Page
 * Gestione pacchetti con filtri avanzati e quick actions
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  RefreshCw,
  Filter,
  List,
  LayoutGrid,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Leaf,
  Zap,
  ChevronRight,
  ChevronDown,
  Info,
  ArrowUpDown,
  Edit3,
  Download,
  Upload,
  Share2,
  ListPlus
} from 'lucide-react'
import { useAdb } from '@/hooks/useAdb'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from '@/stores/i18nStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Modal, ModalActions } from '@/components/ui/Modal'
import { FilterPanel, ActiveFiltersChips, defaultFilters, type FilterState, type RemovalLevel } from '@/components/debloater/FilterPanel'
import { DescriptionEditModal } from '@/components/debloater/DescriptionEditModal'
import {
  getPackageDatabase,
  getImpactColor,
  clearPackageCache,
  refreshPackageDatabase,
  type PackageDefinition,
  type RemovalImpact
} from '@/services/package-database'
import { logUserAction, supabase } from '@/services/supabase'
import { useAdbStore } from '@/stores/adbStore'
import type { PackageInfo } from '@/services/adb-client'
import {
  getAppIcon,
  getCachedIcon,
  getPackageColor,
  getPackageInitials,
  getCachedLabel,
  loadAllFromCache,
  loadFromSupabase,
  registerNewPackages,
  extractAllLabelsFromDevice,
  fetchLabelsFromPlayStore
} from '@/services/app-icons'
import {
  createDebloatList
} from '@/services/supabase'
import { downloadCsv, generatePackagesCsv, parseDebloatCsv, type CsvRow } from '@/services/csv-service'
import { isAdmin, getAppSettings } from '@/config/app'

// Tipi di ordinamento disponibili
export type SortBy = 'name' | 'package' | 'status' | 'risk' | 'category'
export type SortOrder = 'asc' | 'desc'

import { SyncUpdateModal } from '@/components/sync/SyncUpdateModal'

interface EnrichedPackage extends PackageInfo {
  definition?: PackageDefinition
  displayName: string
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.02 }
  }
}

const item = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 }
}

// Tipo di vista per la lista app
export type ViewMode = 'all' | 'enabled' | 'disabled'
export type ListDisplayMode = 'full' | 'compact'

export function DebloaterPage() {
  const { packages, packagesLoading, loadPackages, togglePackage, uninstallRoot, deviceInfo } = useAdb()
  const setCurrentPage = useAppStore((state) => state.setCurrentPage)
  const { user, isAuthenticated } = useAuthStore()
  const currentDeviceId = useAdbStore((state) => state.currentDeviceId)
  const { returnedPackages, setSystemUpdateDetected, setHasShownUpdateModal } = useAdbStore()
  const { t } = useTranslation()

  // Check if user is admin
  const userIsAdmin = isAdmin(user?.id)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [packageDb, setPackageDb] = useState<Record<string, PackageDefinition>>({})
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(100)

  // Root removal toggle
  const [useRootForRemoval, setUseRootForRemoval] = useState(false)

  // Vista: tutte, solo abilitate, solo disabilitate
  const [viewMode, setViewMode] = useState<ViewMode>('all')

  // Display mode: full cards or compact list
  const [listDisplay, setListDisplay] = useState<ListDisplayMode>('full')

  // Ordinamento
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Quick action modals
  const [recommendedModal, setRecommendedModal] = useState(false)
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set())
  const [batchProgress, setBatchProgress] = useState<{
    total: number
    current: number
    currentPackage: string
  } | null>(null)

  // Warning modal state
  const [warningModal, setWarningModal] = useState<{
    open: boolean
    package?: EnrichedPackage
    action?: 'enable' | 'disable'
  }>({ open: false })

  // Description edit modal (solo admin)
  const [editDescriptionModal, setEditDescriptionModal] = useState<{
    open: boolean
    packageName: string
    descriptions: Record<string, string>
    appLabel: string
    labels: string[]
    icon: string | undefined
    removal: RemovalImpact | undefined
  }>({ open: false, packageName: '', descriptions: {}, appLabel: '', labels: [], icon: undefined, removal: undefined })

  // Debloat List state
  const [createListModal, setCreateListModal] = useState(false)
  const [listTitle, setListTitle] = useState('')
  const [listDescription, setListDescription] = useState('')
  const [listIsPublic, setListIsPublic] = useState(false)
  const [isSavingList, setIsSavingList] = useState(false)

  // Selezione multipla pacchetti (manuale)
  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set())

  const toggleManualSelection = (packageName: string) => {
    setManualSelection(prev => {
      const next = new Set(prev)
      if (next.has(packageName)) next.delete(packageName)
      else next.add(packageName)
      return next
    })
  }

  // Handle Export all apps to CSV
  const handleExportAllAppsCSV = () => {
    const nickname = (isAuthenticated && user?.email) ? user.email.split('@')[0] : 'Anonymous'
    const rows: CsvRow[] = enrichedPackages.map(pkg => ({
      packageId: pkg.packageName,
      name: pkg.displayName,
      description: pkg.definition?.description || '',
      level: pkg.definition?.removal || 'Recommended'
    }))

    const csvContent = generatePackagesCsv(
      nickname,
      rows,
      deviceInfo ? { manufacturer: deviceInfo.manufacturer, model: deviceInfo.model } : undefined
    )
    const date = new Date().toISOString().split('T')[0]
    downloadCsv(`adbzero-apps-${date}.csv`, csvContent)

    useAppStore.getState().showToast({
      type: 'success',
      title: 'Export Success',
      message: `${rows.length} apps exported to CSV.`
    })
  }

  // Handle Create Debloat List from selection
  const handleSaveDebloatList = async () => {
    if (!isAuthenticated || !user) {
      useAppStore.getState().showToast({
        type: 'warning',
        title: 'Authentication Required',
        message: 'Please login to save and share lists.'
      })
      return
    }

    if (manualSelection.size === 0) {
      useAppStore.getState().showToast({
        type: 'warning',
        title: 'Empty Selection',
        message: 'Please select at least one app to create a list.'
      })
      return
    }

    if (!listTitle.trim()) {
      useAppStore.getState().showToast({
        type: 'warning',
        title: 'Title Required',
        message: 'Please provide a title for your list.'
      })
      return
    }

    setIsSavingList(true)
    try {
      const nickname = user.email?.split('@')[0] || 'Anonymous'
      const items = Array.from(manualSelection).map(pkgName => {
        const pkg = enrichedPackages.find(p => p.packageName === pkgName)
        return {
          package_name: pkgName,
          label: pkg?.displayName || null,
          description: pkg?.definition?.description || null,
          level: (pkg?.definition?.removal as any) || 'Recommended'
        }
      })

      await createDebloatList(
        user.id,
        nickname,
        listTitle,
        listDescription || null,
        listIsPublic,
        items,
        deviceInfo?.model,
        deviceInfo?.manufacturer
      )

      useAppStore.getState().showToast({
        type: 'success',
        title: 'List Created',
        message: `Your list "${listTitle}" has been saved.`
      })

      setCreateListModal(false)
      setManualSelection(new Set())
      setListTitle('')
      setListDescription('')
    } catch (error) {
      console.error('Failed to create list:', error)
      useAppStore.getState().showToast({
        type: 'error',
        title: 'Error',
        message: 'Could not save your list. Please try again.'
      })
    } finally {
      setIsSavingList(false)
    }
  }

  // Handle Import CSV List
  const handleImportCSVList = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const { rows } = await parseDebloatCsv(file)

      // Select these packages in manual selection
      const importedPkgNames = rows.map(r => r.packageId)
      setManualSelection(new Set(importedPkgNames))

      useAppStore.getState().showToast({
        type: 'success',
        title: 'CSV Imported',
        message: `${rows.length} apps identified from CSV. Review selection below.`
      })
    } catch (error) {
      console.error('CSV Import failed:', error)
      useAppStore.getState().showToast({
        type: 'error',
        title: 'Import Failed',
        message: 'Could not parse CSV. Ensure it follows the correct format.'
      })
    }

    // Clear input
    e.target.value = ''
  }

  // Handle applying the manual selection (same logic as recommended removal)
  const handleApplySelection = async () => {
    const count = manualSelection.size
    if (count === 0) return

    setBatchProgress({ total: count, current: 0, currentPackage: '' })

    const pkgsToDisable = Array.from(manualSelection)
    for (let i = 0; i < pkgsToDisable.length; i++) {
      const pkgName = pkgsToDisable[i]
      const pkg = enrichedPackages.find(p => p.packageName === pkgName)
      setBatchProgress({
        total: count,
        current: i + 1,
        currentPackage: pkg?.displayName || pkgName
      })

      await togglePackage(pkgName, false)

      if (isAuthenticated && user && currentDeviceId) {
        await logUserAction(user.id, currentDeviceId, pkgName, 'disable').catch(() => { })
      }
    }

    setBatchProgress(null)
    setManualSelection(new Set())
    await loadPackages()

    useAppStore.getState().showToast({
      type: 'success',
      title: 'Removal Completed',
      message: `${count} apps were disabled.`
    })
  }

  // ... (keep middle lines same until handleToggle) ...

  // Handle toggle with warning for dangerous packages
  const handleToggle = useCallback(async (pkg: EnrichedPackage, newState: boolean) => {
    const isDisabling = !newState
    const isDangerous = pkg.definition?.removal === 'Unsafe' || pkg.definition?.removal === 'Expert'

    // Root removal logic
    if (isDisabling && useRootForRemoval && deviceInfo?.isRooted) {
      if (isDangerous || pkg.isSystem) {
        setWarningModal({
          open: true,
          package: pkg,
          action: 'disable' // We use 'disable' action but will check useRootForRemoval in confirmation
        })
        return
      }

      setLoadingPackage(pkg.packageName)
      await uninstallRoot(pkg.packageName)
      setLoadingPackage(null)
      return
    }

    if (isDisabling && (isDangerous || pkg.isSystem)) {
      setWarningModal({
        open: true,
        package: pkg,
        action: 'disable'
      })
      return
    }

    setLoadingPackage(pkg.packageName)
    await togglePackage(pkg.packageName, newState)
    setLoadingPackage(null)
  }, [togglePackage, uninstallRoot, isAuthenticated, user, currentDeviceId, useRootForRemoval, deviceInfo])

  const confirmAction = async () => {
    if (!warningModal.package) return

    setWarningModal({ open: false })

    setLoadingPackage(warningModal.package.packageName)

    if (warningModal.action === 'enable') {
      await togglePackage(warningModal.package.packageName, true)
    } else {
      // Disable / Uninstall
      if (useRootForRemoval && deviceInfo?.isRooted) {
        await uninstallRoot(warningModal.package.packageName)
      } else {
        await togglePackage(warningModal.package.packageName, false)
      }
    }

    setLoadingPackage(null)
  }

  // ... (rest of code) ...





  // Load packages on mount
  useEffect(() => {
    loadPackages()
  }, [loadPackages])

  // State per i nomi reali e icone caricati in background
  const [realLabels, setRealLabels] = useState<Record<string, string>>({})
  const [realIcons, setRealIcons] = useState<Record<string, string>>({})
  const [cacheLoaded, setCacheLoaded] = useState(false)

  // Carica la cache IndexedDB all'avvio (una sola volta)
  useEffect(() => {
    loadAllFromCache().then(() => {
      setCacheLoaded(true)
      console.log('📦 IndexedDB cache loaded')
    })
  }, [])

  // Carica dati da Supabase e dal dispositivo quando i pacchetti cambiano
  useEffect(() => {
    if (packages.length === 0 || !cacheLoaded) return

    let cancelled = false
    const packageNames = packages.map(p => p.packageName)

    const updateCachedData = () => {
      if (cancelled) return

      const labels: Record<string, string> = {}
      const icons: Record<string, string> = {}

      for (const pkgName of packageNames) {
        const label = getCachedLabel(pkgName)
        const icon = getCachedIcon(pkgName)
        if (label) labels[pkgName] = label
        if (icon) icons[pkgName] = icon
      }

      setRealLabels(prev => ({ ...prev, ...labels }))
      setRealIcons(prev => ({ ...prev, ...icons }))
    }

    const loadData = async () => {
      // 0. Registra i pacchetti nuovi nel database (così esistono per modifiche admin)
      registerNewPackages(packageNames)

      // 1. Carica Definizioni (descrizioni, impatto) SOLO per i pacchetti rilevati
      getPackageDatabase(packageNames).then(db => {
        if (!cancelled) setPackageDb(db.packages)
      })

      // 2. Carica Icone/Nomi da Supabase (veloce, dati già noti)
      await loadFromSupabase(packageNames)
      updateCachedData()

      // Solo se il device scraping è abilitato, estrai nomi e icone dal dispositivo
      if (getAppSettings().enableDeviceScraping) {
        // 2. Usa il metodo batch per estrarre i nomi rimanenti
        await extractAllLabelsFromDevice(
          packageNames.slice(0, 80),
          (current, total, _pkgName, _label) => {
            if (!cancelled && (current % 5 === 0 || current === total)) {
              updateCachedData()
            }
          }
        )

        updateCachedData()

        // 3. Play Store come fallback per i nomi ancora mancanti
        const stillMissing = packageNames.filter(pkg => !getCachedLabel(pkg))
        if (stillMissing.length > 0 && !cancelled) {
          console.log(`🌐 Cercando ${Math.min(stillMissing.length, 15)} nomi sul Play Store...`)
          await fetchLabelsFromPlayStore(stillMissing.slice(0, 15), {
            maxPackages: 15,
            delayMs: 1200,
            maxConcurrent: 2,
            onProgress: (current, total, _pkgName, _label) => {
              if (!cancelled && (current % 3 === 0 || current === total)) {
                updateCachedData()
              }
            }
          })
          updateCachedData()
        }

        // 4. Poi carica le icone in batch
        const toLoad = packageNames.filter(pkg => !getCachedIcon(pkg)).slice(0, 50)
        const batchSize = 3

        for (let i = 0; i < toLoad.length && !cancelled; i += batchSize) {
          const batch = toLoad.slice(i, i + batchSize)
          await Promise.all(batch.map(pkg => getAppIcon(pkg)))
          updateCachedData()
        }
      } else {
        console.log('🚫 Device scraping disabilitato — uso solo cache e database')
      }
    }

    loadData()

    return () => { cancelled = true }
  }, [packages, cacheLoaded])

  // Enrich packages with definitions
  const enrichedPackages = useMemo((): EnrichedPackage[] => {
    return packages.map((pkg) => {
      const definition = packageDb[pkg.packageName]

      // Priorità nome:
      // 1. Nome personalizzato admin (descriptions['label'])
      // 2. Nome estratto dal dispositivo (realLabels)
      // 3. Package name formattato (fallback, NON salvato nel DB)
      let displayName = pkg.packageName // Default: mostra package name

      // Estrai label con validazione robusta
      const adminLabel = definition?.descriptions?.['label']
      const deviceLabel = realLabels[pkg.packageName]

      // Funzione per validare che un nome sia valido
      const isValidName = (name: unknown): name is string => {
        if (typeof name !== 'string') return false
        if (name.length === 0) return false
        if (name.length > 200) return false

        const trimmed = name.trim()
        if (trimmed.length === 0) return false

        // Lista di valori invalidi noti
        const invalidValues = [
          'null', '"null"', 'undefined', '"undefined"',
          'Not Found', 'not found', 'NOT FOUND',
          'unknown', 'Unknown', '""', "''",
          '', ' '
        ]

        if (invalidValues.includes(trimmed)) return false
        if (invalidValues.includes(name)) return false

        return true
      }

      if (isValidName(adminLabel)) {
        displayName = adminLabel
      } else if (isValidName(deviceLabel)) {
        displayName = deviceLabel
      } else {
        // Nessun nome valido: usa il package name completo come richiesto
        displayName = pkg.packageName
      }

      // Fallback finale: se displayName è ancora invalido, usa packageName
      if (!isValidName(displayName)) {
        displayName = pkg.packageName
      }

      return {
        ...pkg,
        definition,
        displayName
      }
    })
  }, [packages, packageDb, realLabels])

  // Get available filter options from data
  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    enrichedPackages.forEach(pkg => {
      if (pkg.definition?.list) {
        categories.add(pkg.definition.list)
      }
    })
    return Array.from(categories).sort()
  }, [enrichedPackages])

  const availableManufacturers = useMemo(() => {
    // Extract manufacturer from package names
    const manufacturers = new Set<string>()
    enrichedPackages.forEach(pkg => {
      const parts = pkg.packageName.split('.')
      if (parts.length >= 2) {
        const mfr = parts[1].toLowerCase()
        if (['samsung', 'xiaomi', 'huawei', 'oppo', 'vivo', 'google', 'facebook', 'meta', 'microsoft', 'amazon'].includes(mfr)) {
          manufacturers.add(mfr.charAt(0).toUpperCase() + mfr.slice(1))
        }
      }
    })
    return Array.from(manufacturers).sort()
  }, [enrichedPackages])

  // Conta app abilitate e disabilitate
  const enabledCount = useMemo(() =>
    enrichedPackages.filter(p => p.isEnabled).length, [enrichedPackages])
  const disabledCount = useMemo(() =>
    enrichedPackages.filter(p => !p.isEnabled).length, [enrichedPackages])

  // Filter and search packages
  const filteredPackages = useMemo(() => {
    // Prima filtra per viewMode
    let basePackages = enrichedPackages
    if (viewMode === 'enabled') {
      basePackages = enrichedPackages.filter(p => p.isEnabled)
    } else if (viewMode === 'disabled') {
      basePackages = enrichedPackages.filter(p => !p.isEnabled)
    }

    // Poi applica i filtri standard
    const filtered = basePackages.filter(pkg => {
      // Search filter
      const searchLower = search.toLowerCase()
      const matchesSearch = !search ||
        pkg.packageName.toLowerCase().includes(searchLower) ||
        pkg.displayName.toLowerCase().includes(searchLower) ||
        pkg.definition?.description?.toLowerCase().includes(searchLower)

      // Status filter (se viewMode != 'all', questo filtro è già applicato)
      let matchesStatus = true
      if (viewMode === 'all') {
        if (filters.status === 'enabled') matchesStatus = pkg.isEnabled
        if (filters.status === 'disabled') matchesStatus = !pkg.isEnabled
      }

      // Type filter
      let matchesType = true
      if (filters.type === 'system') matchesType = pkg.isSystem
      if (filters.type === 'user') matchesType = !pkg.isSystem

      // Category filter
      let matchesCategory = filters.categories.length === 0 ||
        (pkg.definition?.list && filters.categories.includes(pkg.definition.list))

      // Manufacturer filter
      let matchesManufacturer = filters.manufacturers.length === 0
      if (!matchesManufacturer) {
        const parts = pkg.packageName.split('.')
        if (parts.length >= 2) {
          const mfr = parts[1].toLowerCase()
          matchesManufacturer = filters.manufacturers.some(m => m.toLowerCase() === mfr)
        }
      }

      // Removal level filter
      let matchesLevel = filters.removalLevels.length === 0 ||
        (pkg.definition?.removal && filters.removalLevels.includes(pkg.definition.removal as RemovalLevel))

      // Source filter
      let matchesSource = filters.source === 'all'
      if (!matchesSource) {
        if (filters.source === 'uad') matchesSource = !!pkg.definition
        if (filters.source === 'unknown') matchesSource = !pkg.definition
      }

      return matchesSearch && matchesStatus && matchesType &&
        matchesCategory && matchesManufacturer && matchesLevel && matchesSource
    })

    // Poi ordina
    const riskOrder: Record<string, number> = { 'Unsafe': 0, 'Expert': 1, 'Advanced': 2, 'Recommended': 3 }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName)
          break
        case 'package':
          comparison = a.packageName.localeCompare(b.packageName)
          break
        case 'status':
          comparison = (b.isEnabled ? 1 : 0) - (a.isEnabled ? 1 : 0)
          break
        case 'risk':
          const aRisk = riskOrder[a.definition?.removal || 'Advanced'] ?? 2
          const bRisk = riskOrder[b.definition?.removal || 'Advanced'] ?? 2
          comparison = aRisk - bRisk
          break
        case 'category':
          comparison = (a.definition?.list || 'zzz').localeCompare(b.definition?.list || 'zzz')
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [enrichedPackages, search, filters, sortBy, sortOrder, viewMode])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(100)
  }, [search, filters, sortBy, sortOrder, viewMode])

  // Get recommended packages (for quick action)
  const recommendedPackages = useMemo(() => {
    return enrichedPackages.filter(pkg =>
      pkg.isEnabled && pkg.definition?.removal === 'Recommended'
    )
  }, [enrichedPackages])



  // Inizializza le selezioni quando si apre il modal
  useEffect(() => {
    if (recommendedModal) {
      // Seleziona tutte le app di default
      setSelectedPackages(new Set(recommendedPackages.map(p => p.packageName)))
    } else {
      // Reset quando si chiude
      setSelectedPackages(new Set())
    }
  }, [recommendedModal, recommendedPackages])

  // Toggle selezione singola app
  const togglePackageSelection = (packageName: string) => {
    setSelectedPackages(prev => {
      const next = new Set(prev)
      if (next.has(packageName)) {
        next.delete(packageName)
      } else {
        next.add(packageName)
      }
      return next
    })
  }

  // Seleziona/Deseleziona tutte
  const toggleAllPackages = () => {
    if (selectedPackages.size === recommendedPackages.length) {
      setSelectedPackages(new Set())
    } else {
      setSelectedPackages(new Set(recommendedPackages.map(p => p.packageName)))
    }
  }

  // Batch disable recommended packages (solo quelle selezionate)
  const disableRecommended = async () => {
    const packagesToDisable = recommendedPackages.filter(p => selectedPackages.has(p.packageName))

    if (packagesToDisable.length === 0) {
      useAppStore.getState().showToast({
        type: 'info',
        title: t('debloater.noAppSelected'),
        message: t('debloater.selectAtLeastOne')
      })
      return
    }

    setRecommendedModal(false)
    setBatchProgress({ total: packagesToDisable.length, current: 0, currentPackage: '' })

    for (let i = 0; i < packagesToDisable.length; i++) {
      const pkg = packagesToDisable[i]
      setBatchProgress({
        total: packagesToDisable.length,
        current: i + 1,
        currentPackage: pkg.displayName
      })

      await togglePackage(pkg.packageName, false)

      // Log action if authenticated
      if (isAuthenticated && user && currentDeviceId) {
        try {
          await logUserAction(user.id, currentDeviceId, pkg.packageName, 'disable')
        } catch (e) {
          console.warn('Failed to log action:', e)
        }
      }

      // Small delay between operations
      await new Promise(r => setTimeout(r, 100))
    }

    setBatchProgress(null)
    setSelectedPackages(new Set())
    await loadPackages()

    useAppStore.getState().showToast({
      type: 'success',
      title: t('debloater.completed'),
      message: t('debloater.appsDisabled', { count: packagesToDisable.length })
    })
  }

  const activeFiltersCount =
    (filters.status !== 'all' ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.source !== 'all' ? 1 : 0) +
    filters.categories.length +
    filters.manufacturers.length +
    filters.removalLevels.length

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto terminal-spacer">
          <SyncUpdateModal />
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
                  {t('debloater.title')}
                </h1>
                <p className="text-surface-500 mt-1">
                  {filteredPackages.length} {t('debloater.packages')}
                  {activeFiltersCount > 0 && ` (${activeFiltersCount} ${t('debloater.filtersActive')})`}
                </p>
              </div>
              {/* Root Mode Toggle */}
              {deviceInfo?.isRooted && (
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/20 mr-auto sm:mr-0 order-last sm:order-none w-full sm:w-auto">
                  <Switch
                    checked={useRootForRemoval}
                    onChange={setUseRootForRemoval}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                      {t('debloater.rootMode')}
                    </span>
                    <span className="text-[10px] text-surface-500 leading-none">
                      Root Access
                    </span>
                  </div>
                </div>
              )}
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className={`w-4 h-4 ${packagesLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />}
                onClick={loadPackages}
                loading={packagesLoading}
              >
                {t('common.refresh')}
              </Button>
              {userIsAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-surface-400"
                  onClick={async () => {
                    const { data, error } = await supabase.from('uad_packages').select('*').limit(5).order('updated_at', { ascending: false })
                    console.log('DEBUG DB:', data, error)
                    alert('Debug DB (Last 5 updated):\n' + JSON.stringify(data?.map(d => ({ pkg: d.package_name, icon: !!d.icon_base64, desc: d.description })), null, 2))
                  }}
                >
                  Debug
                </Button>
              )}
              {userIsAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-surface-400"
                  onClick={() => {
                    const pkgName = prompt("Inserisci nome pacchetto:", "com.instagram.android")
                    if (pkgName) {
                      const pkg = packageDb[pkgName]
                      console.log('UI PKG:', pkg)
                      alert(`UI State for ${pkgName}:\n` + JSON.stringify(pkg, null, 2))
                    }
                  }}
                >
                  Inspect UI
                </Button>
              )}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
          >
            {/* Disable Recommended */}
            <button
              onClick={() => setRecommendedModal(true)}
              disabled={recommendedPackages.length === 0}
              className="glass-card p-4 flex items-center gap-4 text-left hover:border-emerald-500/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-3 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                <Sparkles className="w-6 h-6 text-emerald-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-surface-900 dark:text-white">
                  {t('debloater.removeBloatware')}
                </p>
                <p className="text-sm text-surface-500">
                  {recommendedPackages.length} {t('debloater.recommendedApps')}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-surface-400 group-hover:text-emerald-500 transition-colors" strokeWidth={1.5} />
            </button>

            {/* De-Google */}
            <button
              onClick={() => setCurrentPage('degoogle')}
              className="glass-card p-4 flex items-center gap-4 text-left hover:border-blue-500/50 transition-all group"
            >
              <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <Leaf className="w-6 h-6 text-blue-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-surface-900 dark:text-white">
                  De-Google
                </p>
                <p className="text-sm text-surface-500">
                  {t('debloater.degoogleDesc')}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-surface-400 group-hover:text-blue-500 transition-colors" strokeWidth={1.5} />
            </button>

            {/* Re-Debloat */}
            <button
              onClick={() => {
                setSystemUpdateDetected(true)
                setHasShownUpdateModal(false)
              }}
              disabled={!isAuthenticated || returnedPackages.length === 0}
              className={`
                glass-card p-4 flex items-center gap-4 text-left hover:border-indigo-500/50 transition-all group
                ${(!isAuthenticated || returnedPackages.length === 0) ? 'opacity-50 cursor-not-allowed grayscale' : ''}
              `}
            >
              <div className="p-3 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                <RefreshCw className={`w-6 h-6 text-indigo-500 ${returnedPackages.length > 0 ? 'animate-pulse-slow' : ''}`} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-surface-900 dark:text-white">
                  {t('sync.autoRedebloat')}
                </p>
                <p className="text-sm text-surface-500">
                  {returnedPackages.length > 0
                    ? t('sync.returnedPackagesDesc', { count: returnedPackages.length })
                    : t('sync.autoRedebloatDesc')
                  }
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-surface-400 group-hover:text-indigo-500 transition-colors" strokeWidth={1.5} />
            </button>
          </motion.div>

          {/* View Mode Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            <button
              onClick={() => setViewMode('all')}
              className={`
                flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-all
                ${viewMode === 'all'
                  ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
                  : 'bg-surface-100 dark:bg-white/5 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-white/10'
                }
              `}
            >
              {t('debloater.viewAll')}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${viewMode === 'all' ? 'bg-white/20' : 'bg-surface-300 dark:bg-white/10'}`}>
                {enrichedPackages.length}
              </span>
            </button>
            <button
              onClick={() => setViewMode('enabled')}
              className={`
                flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-all
                ${viewMode === 'enabled'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-surface-100 dark:bg-white/5 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-white/10'
                }
              `}
            >
              {t('debloater.viewEnabled')}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${viewMode === 'enabled' ? 'bg-white/20' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                {enabledCount}
              </span>
            </button>
            <button
              onClick={() => setViewMode('disabled')}
              className={`
                flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-all
                ${viewMode === 'disabled'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                  : 'bg-surface-100 dark:bg-white/5 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-white/10'
                }
              `}
            >
              {t('debloater.viewDisabled')}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${viewMode === 'disabled' ? 'bg-white/20' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                {disabledCount}
              </span>
            </button>

            {/* Compact/Full toggle */}
            <div className="flex gap-1 ml-auto bg-surface-100 dark:bg-white/5 rounded-xl p-1">
              <button
                onClick={() => setListDisplay('full')}
                className={`p-2 rounded-lg transition-all ${listDisplay === 'full' ? 'bg-white dark:bg-white/15 shadow-sm' : 'text-surface-400 hover:text-surface-600'}`}
                title="Full view"
              >
                <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setListDisplay('compact')}
                className={`p-2 rounded-lg transition-all ${listDisplay === 'compact' ? 'bg-white dark:bg-white/15 shadow-sm' : 'text-surface-400 hover:text-surface-600'}`}
                title="Compact view"
              >
                <List className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>

          {/* Search & Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-4 mb-6"
          >
            <div className="flex gap-2 sm:gap-4">
              <div className="flex-1">
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch('')}
                  placeholder={t('debloater.searchPackage')}
                />
              </div>

              {/* Sort Dropdown */}
              <div className="relative">
                <Button
                  variant="secondary"
                  icon={<ArrowUpDown className="w-4 h-4" strokeWidth={1.5} />}
                  onClick={() => setShowSortMenu(!showSortMenu)}
                >
                  <span className="hidden sm:inline">{t('common.sort')}</span>
                </Button>

                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 top-full mt-2 w-56 py-2 rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-800 shadow-lg z-20"
                  >
                    <div className="px-3 py-2 text-xs font-medium text-surface-500 uppercase tracking-wider">
                      {t('debloater.sortBy')}
                    </div>
                    {[
                      { value: 'name', labelKey: 'debloater.sortName' },
                      { value: 'package', labelKey: 'debloater.sortPackage' },
                      { value: 'status', labelKey: 'debloater.sortStatus' },
                      { value: 'risk', labelKey: 'debloater.sortRisk' },
                      { value: 'category', labelKey: 'debloater.sortCategory' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          if (sortBy === option.value) {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortBy(option.value as SortBy)
                            setSortOrder('asc')
                          }
                          setShowSortMenu(false)
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-surface-100 dark:hover:bg-white/5 transition-colors ${sortBy === option.value ? 'text-accent-600 dark:text-accent-400 bg-accent-500/5' : 'text-surface-700 dark:text-surface-300'
                          }`}
                      >
                        <span>{t(option.labelKey)}</span>
                        {sortBy === option.value && (
                          <span className="text-xs">
                            {sortOrder === 'asc' ? `↑ ${t('debloater.ascending')}` : `↓ ${t('debloater.descending')}`}
                          </span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              <Button
                variant={showFilters || activeFiltersCount > 0 ? 'primary' : 'secondary'}
                icon={<Filter className="w-4 h-4" strokeWidth={1.5} />}
                onClick={() => setShowFilters(!showFilters)}
              >
                <span className="hidden sm:inline">{t('common.filters')}</span>
                {activeFiltersCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-white/20 rounded-md">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Active Filters Chips */}
            <ActiveFiltersChips filters={filters} onChange={setFilters} />
          </motion.div>

          {/* Action Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.11 }}
            className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-surface-50 dark:bg-white/5 p-4 rounded-2xl border border-surface-200 dark:border-white/5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={handleExportAllAppsCSV}
                title="Export all installed apps to CSV"
              >
                Export CSV
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleImportCSVList}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Upload className="w-4 h-4" />}
                >
                  Import CSV List
                </Button>
              </div>
            </div>

            {manualSelection.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-accent-500 mr-2">
                  {manualSelection.size} selected
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<ListPlus className="w-4 h-4" />}
                  onClick={() => setCreateListModal(true)}
                >
                  Create List
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleApplySelection}
                >
                  Disable Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setManualSelection(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}
          </motion.div>

          {/* Batch Progress */}
          <AnimatePresence>
            {batchProgress && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 glass-card p-4"
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Zap className="w-6 h-6 text-accent-500" strokeWidth={1.5} />
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">
                      {t('debloater.disablingApp', { name: batchProgress.currentPackage })}
                    </p>
                    <p className="text-xs text-surface-500">
                      {t('debloater.completedOf', { current: batchProgress.current, total: batchProgress.total })}
                    </p>
                    <div className="mt-2 h-1.5 bg-surface-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-accent-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Package List */}
          {packagesLoading && packages.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 16 }).map((_, i) => (
                <Card key={i} variant="glass" padding="none" className="overflow-hidden">
                  <div className="flex items-center gap-4 p-4 animate-pulse">
                    {/* Checkbox skeleton */}
                    <div className="w-4 h-4 rounded bg-surface-200 dark:bg-white/10 flex-shrink-0" />
                    {/* Icon skeleton */}
                    <div className="w-11 h-11 rounded-xl bg-surface-200 dark:bg-white/10 flex-shrink-0" />
                    {/* Text skeleton */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 rounded-lg bg-surface-200 dark:bg-white/10"
                          style={{ width: `${30 + Math.sin(i * 1.7) * 20 + 20}%` }}
                        />
                        {i % 3 === 0 && (
                          <div className="h-4 w-12 rounded-full bg-surface-100 dark:bg-white/5" />
                        )}
                      </div>
                      <div
                        className="h-2.5 rounded bg-surface-100 dark:bg-white/5"
                        style={{ width: `${50 + Math.cos(i * 2.3) * 15 + 20}%` }}
                      />
                    </div>
                    {/* Toggle skeleton */}
                    <div className="w-10 h-6 rounded-full bg-surface-200 dark:bg-white/10 flex-shrink-0" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-12 h-12 mx-auto text-surface-400 mb-4" strokeWidth={1} />
              <p className="text-surface-500">{t('debloater.noPackageFound')}</p>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters(defaultFilters)}
                  className="mt-4"
                >
                  {t('debloater.removeFilters')}
                </Button>
              )}
            </div>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {filteredPackages.slice(0, visibleCount).map((pkg) => (
                <PackageRow
                  key={pkg.packageName}
                  package={pkg}
                  loading={loadingPackage === pkg.packageName}
                  onToggle={(newState) => handleToggle(pkg, newState)}
                  isAdmin={userIsAdmin}
                  onEditDescription={(pkg) => setEditDescriptionModal({
                    open: true,
                    packageName: pkg.packageName,
                    descriptions: pkg.definition?.descriptions || {},
                    appLabel: pkg.definition?.descriptions?.['label'] || realLabels[pkg.packageName] || '',
                    labels: pkg.definition?.labels || [],
                    icon: realIcons[pkg.packageName],
                    removal: pkg.definition?.removal
                  })}
                  cachedIcon={realIcons[pkg.packageName]}
                  selected={manualSelection.has(pkg.packageName)}
                  onSelect={() => toggleManualSelection(pkg.packageName)}
                  displayMode={listDisplay}
                />
              ))}

              {filteredPackages.length > visibleCount && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <p className="text-sm text-surface-500">
                    {t('debloater.showingPackages', { count: visibleCount, total: filteredPackages.length })}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => setVisibleCount(prev => prev + 50)}
                  >
                    {t('common.loadMore')}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            availableCategories={availableCategories}
            availableManufacturers={availableManufacturers}
            availableDevices={[]}
            onClose={() => setShowFilters(false)}
          />
        )}
      </AnimatePresence>

      {/* Create List Modal */}
      <AnimatePresence>
        {createListModal && (
          <Modal
            isOpen={createListModal}
            onClose={() => setCreateListModal(false)}
            title="Create Debloat List"
          >
            <div className="space-y-4">
              <p className="text-sm text-surface-500">
                Create a debloating list with the {manualSelection.size} selected apps.
                Authenticated users can save lists and share them with the community.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-[#f0f6fc]">List Title</label>
                <SearchInput
                  placeholder="e.g. My Samsung S24 Ultra Cleanup"
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-[#f0f6fc]">Description (Optional)</label>
                <textarea
                  className="w-full h-24 p-3 rounded-xl bg-surface-50 dark:bg-[#0d1117] border border-surface-200 dark:border-[#30363d] text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                  placeholder="Describe what this list does and which devices it targets..."
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-accent-500/5 rounded-xl border border-accent-500/10">
                <div>
                  <p className="text-sm font-bold text-surface-900 dark:text-[#f0f6fc]">Share with Community</p>
                  <p className="text-xs text-surface-500">Allow other ADB Zero users to discover and use this list.</p>
                </div>
                <Switch
                  checked={listIsPublic}
                  onChange={setListIsPublic}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="ghost" onClick={() => setCreateListModal(false)}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleSaveDebloatList}
                  disabled={isSavingList}
                  icon={isSavingList ? null : <Share2 className="w-4 h-4" />}
                >
                  {isSavingList ? 'Saving...' : 'Save & Share'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
      {/* Recommended Modal */}
      <Modal
        isOpen={recommendedModal}
        onClose={() => {
          setRecommendedModal(false)
          setSelectedPackages(new Set())
        }}
        title={t('debloater.removeBloatwareTitle')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-surface-600 dark:text-surface-400">
              {t('debloater.selectAppsToDisable')} <strong>{selectedPackages.size}</strong> {t('common.of')} <strong>{recommendedPackages.length}</strong> {t('debloater.appsSelected')}.
            </p>
            <button
              onClick={toggleAllPackages}
              className="text-sm text-accent-500 hover:text-accent-400 font-medium transition-colors"
            >
              {selectedPackages.size === recommendedPackages.length ? t('common.deselectAll') : t('common.selectAll')}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
            {recommendedPackages.map(pkg => {
              const isSelected = selectedPackages.has(pkg.packageName)
              const description = pkg.definition?.description

              return (
                <button
                  key={pkg.packageName}
                  onClick={() => togglePackageSelection(pkg.packageName)}
                  className={`
                    w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all
                    ${isSelected
                      ? 'bg-accent-500/10 border-accent-500/30'
                      : 'bg-surface-100 dark:bg-white/5 border-surface-200 dark:border-white/10 hover:border-accent-500/20'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePackageSelection(pkg.packageName)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-4 h-4 rounded border-surface-300 dark:border-surface-600 
                      text-accent-500 focus:ring-accent-500 focus:ring-2 cursor-pointer
                      dark:bg-surface-700 dark:checked:bg-accent-500 flex-shrink-0"
                  />
                  <Package className={`w-4 h-4 flex-shrink-0 mt-1 ${isSelected ? 'text-accent-500' : 'text-emerald-500'}`} strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-surface-900 dark:text-white">
                        {pkg.displayName}
                      </p>
                    </div>
                    <p className="text-xs text-surface-500 truncate font-mono mb-1">
                      {pkg.packageName}
                    </p>
                    {description && (
                      <p className="text-xs text-surface-600 dark:text-surface-400 line-clamp-2 mt-1">
                        {description}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t('debloater.disablingNote')}
            </p>
          </div>
        </div>

        <ModalActions>
          <Button
            variant="ghost"
            onClick={() => {
              setRecommendedModal(false)
              setSelectedPackages(new Set())
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={disableRecommended}
            disabled={selectedPackages.size === 0}
          >
            {t('debloater.disableApps', { count: selectedPackages.size })}
          </Button>
        </ModalActions>
      </Modal>

      {/* Warning Modal */}
      <Modal
        isOpen={warningModal.open}
        onClose={() => setWarningModal({ open: false })}
        title={t('debloater.attention')}
        size="md"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10">
            <AlertTriangle className="w-6 h-6 text-amber-500" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-surface-900 dark:text-white font-medium mb-2">
              {t('debloater.confirmDisable')}
            </p>
            <p className="text-sm text-surface-500 mb-4">
              <strong>{warningModal.package?.displayName}</strong>
              <br />
              <code className="text-xs">{warningModal.package?.packageName}</code>
            </p>
            {warningModal.package?.definition?.description && (
              <p className="text-sm text-surface-500 mb-4">
                {warningModal.package.definition.description}
              </p>
            )}
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-600 dark:text-red-400">
                {t('debloater.systemAppWarning')}
              </p>
            </div>
          </div>
        </div>

        <ModalActions>
          <Button
            variant="ghost"
            onClick={() => setWarningModal({ open: false })}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={confirmAction}
          >
            {t('debloater.disableAnyway')}
          </Button>
        </ModalActions>
      </Modal>

      {/* Description Edit Modal - Solo Admin */}
      {userIsAdmin && (
        <DescriptionEditModal
          isOpen={editDescriptionModal.open}
          onClose={() => setEditDescriptionModal({ open: false, packageName: '', descriptions: {}, appLabel: '', labels: [], icon: undefined, removal: undefined })}
          packageName={editDescriptionModal.packageName}
          currentDescriptions={editDescriptionModal.descriptions}
          currentAppLabel={editDescriptionModal.appLabel}
          currentLabels={editDescriptionModal.labels}
          currentIcon={editDescriptionModal.icon}
          currentRemoval={editDescriptionModal.removal}
          onSaved={() => {
            // Pulisci cache e ricarica database per i pacchetti correnti
            clearPackageCache()
            const packageNames = packages.map(p => p.packageName)
            refreshPackageDatabase(packageNames).then(db => {
              console.log('📦 Database refreshed after save:', Object.keys(db.packages).length, 'packages')
              setPackageDb(db.packages)
            })
          }}
        />
      )}
    </div>
  )
}

interface PackageRowProps {
  package: EnrichedPackage
  loading: boolean
  onToggle: (newState: boolean) => void
  isAdmin?: boolean
  onEditDescription?: (pkg: EnrichedPackage) => void
  cachedIcon?: string | null
  selected?: boolean
  onSelect?: (selected: boolean) => void
  displayMode?: ListDisplayMode
}

function PackageRow({ package: pkg, loading, onToggle, isAdmin, onEditDescription, cachedIcon, selected, onSelect, displayMode = 'full' }: PackageRowProps) {
  const [expanded, setExpanded] = useState(false)
  const adminIcon = pkg.definition?.iconBase64
  const [iconUrl, setIconUrl] = useState<string | null>(adminIcon || cachedIcon || null)
  const { t } = useTranslation()
  const descRef = useRef<HTMLParagraphElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  const impactColor = pkg.definition?.removal
    ? getImpactColor(pkg.definition.removal)
    : null

  const hasDescription = !!pkg.definition?.description

  // Check real visual overflow
  useEffect(() => {
    if (descRef.current && !expanded) {
      setIsOverflowing(descRef.current.scrollHeight > descRef.current.clientHeight)
    }
  }, [pkg.definition?.description, expanded])

  // Aggiorna l'icona quando arriva dalla cache o c'è un override admin
  useEffect(() => {
    if (adminIcon) {
      setIconUrl(adminIcon)
      return
    }
    if (cachedIcon) {
      setIconUrl(cachedIcon)
    }
  }, [cachedIcon, adminIcon])

  // Carica l'icona se non è già in cache (e non c'è adminIcon)
  useEffect(() => {
    if (iconUrl || adminIcon) return
    if (!getAppSettings().enableDeviceScraping) return

    getAppIcon(pkg.packageName).then(url => {
      if (url) setIconUrl(url)
    })
  }, [pkg.packageName, iconUrl])

  // Compact mode
  if (displayMode === 'compact') {
    return (
      <motion.div variants={item}>
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-100 dark:border-white/5 hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-colors">
          {/* Selection Checkbox */}
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-surface-300 dark:border-surface-600 text-accent-500 focus:ring-accent-500 cursor-pointer dark:bg-surface-700 dark:checked:bg-accent-500 flex-shrink-0"
          />

          {/* Tiny Icon */}
          <div className={`
            w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden
            ${iconUrl ? '' : getPackageColor(pkg.packageName)}
            ${!iconUrl && !pkg.isEnabled ? 'opacity-50' : ''}
          `}>
            {iconUrl ? (
              <img
                src={iconUrl}
                alt={pkg.displayName}
                className={`w-full h-full object-cover ${!pkg.isEnabled ? 'opacity-50 grayscale' : ''}`}
              />
            ) : (
              <span className="text-white text-[9px] font-bold">
                {getPackageInitials(pkg.displayName)}
              </span>
            )}
          </div>

          {/* Name + package */}
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <p className={`text-sm font-medium truncate ${pkg.isEnabled ? 'text-surface-900 dark:text-white' : 'text-surface-500'}`}>
              {pkg.displayName}
            </p>
            <p className="text-[10px] text-surface-400 truncate font-mono hidden sm:block">
              {pkg.packageName}
            </p>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {pkg.isSystem && (
              <span className="pill-neutral text-[9px]">SYS</span>
            )}
            {impactColor && (
              <span className={`pill text-[9px] ${impactColor.bg} ${impactColor.text}`}>
                {pkg.definition!.removal.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Status */}
          <div className={`
            flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap flex-shrink-0
            ${pkg.isEnabled
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }
          `}>
            {pkg.isEnabled ? (
              <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={2} />
            ) : (
              <XCircle className="w-2.5 h-2.5" strokeWidth={2} />
            )}
          </div>

          {/* Toggle */}
          <Switch
            checked={pkg.isEnabled}
            onChange={onToggle}
            loading={loading}
            size="sm"
          />
        </div>
      </motion.div>
    )
  }

  // Full mode
  return (
    <motion.div variants={item}>
      <Card
        variant="glass"
        padding="none"
        className="overflow-hidden h-full"
      >
        <div className="flex items-center gap-4 p-4">
          {/* Selection Checkbox */}
          <div className="flex-shrink-0">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect?.(e.target.checked)}
              className="w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-accent-500 focus:ring-accent-500 focus:ring-2 cursor-pointer dark:bg-surface-700 dark:checked:bg-accent-500"
            />
          </div>

          {/* Icon - Real icon or colored avatar */}
          <div className={`
            w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden
            ${iconUrl ? '' : getPackageColor(pkg.packageName)}
            ${!iconUrl && !pkg.isEnabled ? 'opacity-50' : ''}
          `}>
            {iconUrl ? (
              <img
                src={iconUrl}
                alt={pkg.displayName}
                className={`w-full h-full object-cover ${!pkg.isEnabled ? 'opacity-50 grayscale' : ''}`}
              />
            ) : (
              <span className="text-white text-xs font-bold">
                {getPackageInitials(pkg.displayName)}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className={`font-medium truncate ${pkg.isEnabled ? 'text-surface-900 dark:text-white' : 'text-surface-500'}`}>
                {pkg.displayName}
              </p>
              {pkg.isSystem && (
                <span className="pill-neutral text-[10px]">{t('common.system')}</span>
              )}
              {impactColor && (
                <span className={`pill text-[10px] ${impactColor.bg} ${impactColor.text}`}>
                  {t(`debloater.impact.${pkg.definition!.removal.toLowerCase()}`)}
                </span>
              )}
              {pkg.definition?.list && (
                <span className="pill-neutral text-[10px]">
                  {pkg.definition.list}
                </span>
              )}
            </div>
            <p className="text-xs text-surface-500 truncate font-mono">
              {pkg.packageName}
            </p>

            {/* Descrizione - con overflow detection */}
            {hasDescription && (
              <div className="mt-2">
                <p
                  ref={descRef}
                  className={`text-xs text-surface-500 dark:text-surface-400 ${expanded ? '' : 'line-clamp-2'}`}
                >
                  {pkg.definition!.description}
                </p>
                {isOverflowing && !expanded && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
                    className="text-xs text-accent-500 hover:text-accent-400 mt-1 flex items-center gap-1"
                  >
                    {t('common.readMore')}
                    <ChevronDown className="w-3 h-3" strokeWidth={2} />
                  </button>
                )}
                {expanded && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
                    className="text-xs text-accent-500 hover:text-accent-400 mt-1 flex items-center gap-1"
                  >
                    {t('common.showLess')}
                    <ChevronDown className="w-3 h-3 rotate-180" strokeWidth={2} />
                  </button>
                )}
              </div>
            )}

            {/* Info badge se non ha descrizione UAD */}
            {!hasDescription && (
              <p className="text-[10px] text-surface-400 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" strokeWidth={1.5} />
                {t('debloater.notInDatabase')}
              </p>
            )}
          </div>

          {/* Status & Toggle */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={`
              flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap
              ${pkg.isEnabled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }
            `}>
              {pkg.isEnabled ? (
                <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
              ) : (
                <XCircle className="w-3 h-3" strokeWidth={2} />
              )}
              {pkg.isEnabled ? t('common.active') : t('common.disabled')}
            </div>

            {/* Edit button - solo admin */}
            {isAdmin && onEditDescription && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEditDescription(pkg)
                }}
                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/10 
                  text-surface-400 hover:text-accent-500 transition-colors"
                title={t('debloater.editDescription')}
              >
                <Edit3 className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}

            <Switch
              checked={pkg.isEnabled}
              onChange={onToggle}
              loading={loading}
              size="sm"
            />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
