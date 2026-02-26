/**
 * De-Google Page
 * Wizard per rimuovere i servizi Google con livelli progressivi
 */

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Leaf,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Package,
  ExternalLink,
  Info,
  Zap,
  Check,
  Shield
} from 'lucide-react'
import { useAdb } from '@/hooks/useAdb'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useAdbStore } from '@/stores/adbStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal, ModalActions } from '@/components/ui/Modal'
import {
  DEGOOGLE_LEVELS,
  type DegoogleLevel,
  type DegoogleLevelConfig
} from '@/data/degoogle-levels'
import {
  getAlternativesForPackage,
  FOSS_ALTERNATIVES,
  type FossApp
} from '@/data/foss-alternatives'
import { saveDegoogleProfile, supabase } from '@/services/supabase'
import { useTranslation } from '@/stores/i18nStore'
import { getPackageDatabase, type PackageDefinition } from '@/services/package-database'
import { AlternativeEditModal } from '@/components/degoogle/AlternativeEditModal'
import { Plus, Edit2 } from 'lucide-react'

type Step = 'select' | 'preview' | 'alternatives' | 'progress' | 'complete'

export function DegooglePage() {
  const { packages, togglePackage, installRemoteApk } = useAdb()
  const setCurrentPage = useAppStore((state) => state.setCurrentPage)
  const { user, isAuthenticated } = useAuthStore()
  const currentDeviceId = useAdbStore((state) => state.currentDeviceId)
  const { t } = useTranslation()

  const [step, setStep] = useState<Step>('select')
  const [selectedLevel, setSelectedLevel] = useState<DegoogleLevel | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0, currentPackage: '' })
  const [results, setResults] = useState<{ success: string[]; failed: string[] }>({ success: [], failed: [] })
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set())
  const [selectedAlternatives, setSelectedAlternatives] = useState<Record<string, FossApp[]>>({})
  const [packageDb, setPackageDb] = useState<Record<string, PackageDefinition>>({})
  const [installationProgress, setInstallationProgress] = useState<Record<string, number>>({})
  const [currentInstallingPkg, setCurrentInstallingPkg] = useState<string | null>(null)

  // Admin Editing State
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAlternative, setEditingAlternative] = useState<{ pkg: string, name: string, alt?: FossApp } | null>(null)
  const [customAlternatives, setCustomAlternatives] = useState<Record<string, FossApp[]>>({})
  const { isAdmin } = useAuthStore()

  // Update selected packages when level changes
  useEffect(() => {
    if (selectedLevel) {
      const levelConfig = DEGOOGLE_LEVELS.find(l => l.id === selectedLevel)
      if (levelConfig) {
        const installed = packages.map(p => p.packageName)
        const toSelect = levelConfig.packages.filter(p => installed.includes(p))
        setSelectedPackages(new Set(toSelect))
      }
    }
  }, [selectedLevel, packages])

  // Get packages that will be affected
  const affectedPackages = useMemo(() => {
    if (!selectedLevel) return []

    const levelConfig = DEGOOGLE_LEVELS.find(l => l.id === selectedLevel)
    if (!levelConfig) return []

    const installedPackageNames = packages.map(p => p.packageName)
    return levelConfig.packages.filter(pkg => installedPackageNames.includes(pkg))
  }, [selectedLevel, packages])

  // Load package database for descriptions
  useEffect(() => {
    if (step === 'preview' && affectedPackages.length > 0) {
      getPackageDatabase(affectedPackages).then(db => {
        setPackageDb(db.packages)
      })
    }
  }, [step, affectedPackages])

  // Get alternatives for affected packages
  const alternatives = useMemo(() => {
    const alts: Record<string, FossApp[]> = {}

    affectedPackages.forEach(pkg => {
      // Start with hardcoded ones
      const fossAlts = [...getAlternativesForPackage(pkg)]

      // Add or override with custom ones from Supabase
      if (customAlternatives[pkg]) {
        customAlternatives[pkg].forEach(custom => {
          const index = fossAlts.findIndex(a => a.packageName === custom.packageName)
          if (index !== -1) {
            fossAlts[index] = custom // Override
          } else {
            fossAlts.push(custom) // Add new
          }
        })
      }

      if (fossAlts.length > 0) {
        alts[pkg] = fossAlts
      }
    })
    return alts
  }, [affectedPackages, customAlternatives])

  // Fetch custom alternatives
  const fetchCustomAlternatives = async () => {
    try {
      const { data, error } = await supabase
        .from('foss_alternatives_overrides')
        .select('*')

      if (error) throw error

      const mapped: Record<string, FossApp[]> = {}
      data?.forEach(row => {
        if (!mapped[row.google_package]) mapped[row.google_package] = []
        mapped[row.google_package].push({
          name: row.name,
          packageName: row.package_name,
          description: row.description,
          apkUrl: row.apk_url,
          fdroidUrl: row.fdroid_url,
          githubUrl: row.github_url,
          features: row.features || []
        })
      })
      setCustomAlternatives(mapped)
    } catch (error) {
      console.error('Error fetching custom alternatives:', error)
    }
  }

  useEffect(() => {
    fetchCustomAlternatives()
  }, [])

  const selectedLevelConfig = useMemo(() => {
    return DEGOOGLE_LEVELS.find(l => l.id === selectedLevel)
  }, [selectedLevel])

  const handleStartDegoogle = () => {
    if (selectedLevel === 'high' || selectedLevel === 'total') {
      setShowConfirmModal(true)
    } else {
      executeDegoogle()
    }
  }

  const executeDegoogle = async () => {
    if (!selectedLevelConfig) return

    const packagesToProcess = affectedPackages.filter(p => selectedPackages.has(p))
    if (packagesToProcess.length === 0) return

    setStep('progress')
    setProgress({ current: 0, total: packagesToProcess.length, currentPackage: '' })

    const success: string[] = []
    const failed: string[] = []

    for (let i = 0; i < packagesToProcess.length; i++) {
      const pkg = packagesToProcess[i]
      setProgress({ current: i + 1, total: packagesToProcess.length, currentPackage: pkg })

      try {
        await togglePackage(pkg, false)
        success.push(pkg)


      } catch (e) {
        console.error(`Failed to disable ${pkg}:`, e)
        failed.push(pkg)
      }

      // Small delay
      await new Promise(r => setTimeout(r, 100))
    }

    // 2. Install selected alternatives (now supports multiple per Google package)
    const alternativesToInstall = Object.entries(selectedAlternatives)
      .filter(([googlePkg]) => success.includes(googlePkg)) // Only if disable was successful
      .flatMap(([_, alts]) => alts) // Flatten arrays of alternatives

    if (alternativesToInstall.length > 0) {
      // Update progress for installation phase
      const totalSteps = packagesToProcess.length + alternativesToInstall.length

      for (let i = 0; i < alternativesToInstall.length; i++) {
        const alt = alternativesToInstall[i]
        const currentStep = packagesToProcess.length + i + 1
        setProgress({
          current: currentStep,
          total: totalSteps,
          currentPackage: `Installing ${alt.name}...`
        })

        // Priorità:
        // 1. apkUrl salvato nel database (inserito dall'admin)
        // 2. apkUrl hardcoded nelle definizioni FOSS
        // 3. GitHub Releases (latest) -> Questo spesso richiede un resolver
        // 4. F-Droid URL -> Spesso è la pagina, non l'APK.
        const dbApkUrl = packageDb[alt.packageName]?.apkUrl
        const installUrl = dbApkUrl || alt.apkUrl ||
          (alt.githubUrl ? `${alt.githubUrl}/releases/latest` : null) ||
          alt.fdroidUrl

        if (installUrl) {
          try {
            setCurrentInstallingPkg(alt.packageName)
            // This will log to terminal and show toasts
            await installRemoteApk(installUrl, alt.packageName, (p) => {
              setInstallationProgress(prev => ({ ...prev, [alt.packageName]: p }))
            })
          } catch (e) {
            console.error(`Failed to install ${alt.name}:`, e)
          } finally {
            setCurrentInstallingPkg(null)
          }
        }
      }
    }

    setResults({ success, failed })

    // Save degoogle profile if authenticated
    if (isAuthenticated && user && currentDeviceId && selectedLevel) {
      try {
        await saveDegoogleProfile(user.id, currentDeviceId, selectedLevel, success)
      } catch (e) {
        console.warn('Failed to save degoogle profile:', e)
      }
    }

    setStep('complete')
  }

  const resetWizard = () => {
    setStep('select')
    setSelectedLevel(null)
    setProgress({ current: 0, total: 0, currentPackage: '' })
    setResults({ success: [], failed: [] })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto terminal-spacer">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10">
            <Leaf className="w-8 h-8 text-blue-500" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
              {t('degoogle.title')}
            </h1>
            <p className="text-surface-500 mt-1">
              {t('degoogle.subtitle')}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Steps Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2">
          {[t('degoogle.selectLevel'), t('degoogle.preview'), t('degoogle.alternatives'), t('degoogle.completed')].map((label, index) => {
            const stepIndex = ['select', 'preview', 'alternatives', 'complete'].indexOf(step)
            const isActive = index <= stepIndex
            const isCurrent = index === stepIndex

            return (
              <div key={label} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  transition-all duration-300
                  ${isActive
                    ? 'bg-accent-500 text-white'
                    : 'bg-surface-200 dark:bg-white/10 text-surface-500'
                  }
                  ${isCurrent ? 'ring-4 ring-accent-500/20' : ''}
                `}>
                  {index + 1}
                </div>
                <span className={`
                  ml-2 text-sm font-medium hidden sm:block
                  ${isActive ? 'text-surface-900 dark:text-white' : 'text-surface-500'}
                `}>
                  {label}
                </span>
                {index < 3 && (
                  <ChevronRight className="w-5 h-5 text-surface-300 dark:text-white/20 mx-4" strokeWidth={1.5} />
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Select Level */}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-surface-600 dark:text-surface-400 mb-6">
              {t('degoogle.chooseLevel')}
            </p>

            {DEGOOGLE_LEVELS.map((level) => {
              const installedCount = packages.filter(p =>
                level.packages.includes(p.packageName)
              ).length

              return (
                <LevelCard
                  key={level.id}
                  level={level}
                  installedCount={installedCount}
                  isSelected={selectedLevel === level.id}
                  onSelect={() => setSelectedLevel(level.id)}
                />
              )
            })}

            <div className="flex justify-end pt-4">
              <Button
                disabled={!selectedLevel}
                onClick={() => setStep('preview')}
              >
                {t('degoogle.continue')}
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && selectedLevelConfig && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card variant="glass" padding="md">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${selectedLevelConfig.bgColor}`}>
                  <Leaf className={`w-6 h-6 ${selectedLevelConfig.color}`} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-white">
                    {t('degoogle.level')}: {t(`degoogle.levels.${selectedLevelConfig.id}.name`)}
                  </h3>
                  <p className="text-sm text-surface-500 mt-1">
                    {t(`degoogle.levels.${selectedLevelConfig.id}.description`)}
                  </p>
                </div>
              </div>
            </Card>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-surface-900 dark:text-white">
                  {t('degoogle.packagesToDisable')} ({selectedPackages.size}/{affectedPackages.length})
                </h3>
                <button
                  onClick={() => {
                    if (selectedPackages.size === affectedPackages.length) {
                      setSelectedPackages(new Set())
                    } else {
                      setSelectedPackages(new Set(affectedPackages))
                    }
                  }}
                  className="text-xs font-medium text-accent-500 hover:text-accent-400 p-1"
                >
                  {selectedPackages.size === affectedPackages.length ? t('common.deselectAll') : t('common.selectAll')}
                </button>
              </div>

              <div className="space-y-2">
                {affectedPackages.map(pkg => {
                  const isSelected = selectedPackages.has(pkg)
                  return (
                    <button
                      key={pkg}
                      onClick={() => {
                        setSelectedPackages(prev => {
                          const next = new Set(prev)
                          if (next.has(pkg)) next.delete(pkg)
                          else next.add(pkg)
                          return next
                        })
                      }}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                        ${isSelected
                          ? 'bg-accent-500/10 border-accent-500/20'
                          : 'bg-surface-100 dark:bg-white/5 border-transparent opacity-60'
                        }
                      `}
                    >
                      <div className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                        ${isSelected
                          ? 'bg-accent-500 border-accent-500'
                          : 'border-surface-300 dark:border-white/20'
                        }
                      `}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Package className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? selectedLevelConfig.color : 'text-surface-400'}`} strokeWidth={1.5} />
                          <span className={`text-sm truncate font-mono ${isSelected ? 'text-surface-900 dark:text-white' : 'text-surface-500'}`}>
                            {pkg}
                          </span>
                        </div>
                        {packageDb[pkg]?.description && (
                          <p className="text-[10px] leading-tight text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                            {packageDb[pkg].description}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
                {affectedPackages.length === 0 && (
                  <p className="text-center text-surface-500 py-8">
                    {t('degoogle.noGooglePackages')}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-medium text-surface-900 dark:text-white mb-4">
                {t('degoogle.consequences')}
              </h3>
              <div className="space-y-2">
                {(t(`degoogle.levels.${selectedLevelConfig.id}.consequences`, undefined, { returnObjects: true }) as any || []).map((consequence: string, i: number) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span className="text-sm text-amber-700 dark:text-amber-400">
                      {consequence}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep('select')}
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                {t('degoogle.back')}
              </Button>
              <Button
                onClick={() => setStep('alternatives')}
                disabled={affectedPackages.length === 0}
              >
                {t('degoogle.viewAlternatives')}
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Alternatives */}
        {step === 'alternatives' && (
          <motion.div
            key="alternatives"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {t('degoogle.fossAlternativesInfo')}
              </p>
            </div>

            <div className="space-y-4">
              {Object.entries(alternatives).map(([googlePkg, alts]) => (
                <Card key={googlePkg} variant="glass" padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-surface-500 font-mono">{googlePkg}</p>
                      <p className="text-sm font-medium text-surface-900 dark:text-white mt-1">
                        {t('degoogle.replaceWith')}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1.5 text-accent-500"
                        onClick={() => {
                          setEditingAlternative({
                            pkg: googlePkg,
                            name: packageDb[googlePkg]?.descriptions?.label || googlePkg
                          })
                          setShowEditModal(true)
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Aggiungi Alternativa
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {alts.map(alt => {
                      const isAltSelected = selectedAlternatives[googlePkg]?.some(a => a.packageName === alt.packageName) || false
                      return (
                        <div key={alt.packageName} className="relative group">
                          <AlternativeCard
                            app={alt}
                            isSelected={isAltSelected}
                            onSelect={() => {
                              setSelectedAlternatives(prev => {
                                const next = { ...prev }
                                const currentSelections = next[googlePkg] || []

                                if (isAltSelected) {
                                  // Remove from selection
                                  next[googlePkg] = currentSelections.filter(a => a.packageName !== alt.packageName)
                                  if (next[googlePkg].length === 0) {
                                    delete next[googlePkg]
                                  }
                                } else {
                                  // Add to selection
                                  next[googlePkg] = [...currentSelections, alt]
                                }
                                return next
                              })
                            }}
                          />
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingAlternative({
                                  pkg: googlePkg,
                                  name: packageDb[googlePkg]?.descriptions?.label || googlePkg,
                                  alt
                                })
                                setShowEditModal(true)
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 
                                text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-white/20"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Card>
              ))}

              {Object.keys(alternatives).length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-surface-400 mb-4" strokeWidth={1} />
                  <p className="text-surface-500">
                    {t('degoogle.noAlternatives')}
                  </p>
                </div>
              )}
            </div>

            {/* Admin Section: All Alternatives */}
            {isAdmin && (
              <div className="mt-8 pt-6 border-t border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
                    Gestione Alternative (Admin)
                  </h3>
                </div>
                <p className="text-sm text-surface-500 mb-4">
                  Qui puoi modificare TUTTE le alternative FOSS, non solo quelle collegate al dispositivo corrente.
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {FOSS_ALTERNATIVES.map(mapping => (
                    <Card key={mapping.googlePackage} variant="glass" padding="sm">
                      <details className="group">
                        <summary className="flex items-center justify-between cursor-pointer list-none">
                          <div>
                            <p className="text-sm font-medium text-surface-900 dark:text-white">
                              {mapping.googleName}
                            </p>
                            <p className="text-xs text-surface-500 font-mono">
                              {mapping.googlePackage}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-surface-400">
                              {mapping.alternatives.length} alternative
                            </span>
                            <ChevronRight className="w-4 h-4 text-surface-400 group-open:rotate-90 transition-transform" />
                          </div>
                        </summary>
                        <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {mapping.alternatives.map(alt => (
                            <div
                              key={alt.packageName}
                              className="flex items-center justify-between p-2 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                                  {alt.name}
                                </p>
                                <p className="text-xs text-surface-500 font-mono truncate">
                                  {alt.packageName}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingAlternative({
                                    pkg: mapping.googlePackage,
                                    name: mapping.googleName,
                                    alt
                                  })
                                  setShowEditModal(true)
                                }}
                                className="p-1.5 rounded-lg text-accent-500 hover:bg-accent-500/10 transition-colors flex-shrink-0"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-accent-500 gap-1"
                            onClick={() => {
                              setEditingAlternative({
                                pkg: mapping.googlePackage,
                                name: mapping.googleName
                              })
                              setShowEditModal(true)
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Aggiungi
                          </Button>
                        </div>
                      </details>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep('preview')}
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                {t('degoogle.back')}
              </Button>
              <Button
                onClick={handleStartDegoogle}
              >
                {t('degoogle.startDegoogling')}
                <Zap className="w-4 h-4" strokeWidth={1.5} />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Progress */}
        {step === 'progress' && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-500/10 flex items-center justify-center"
            >
              <Leaf className="w-10 h-10 text-accent-500" strokeWidth={1.5} />
            </motion.div>

            <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
              {t('degoogle.degooglingInProgress')}
            </h2>
            <p className="text-surface-500 mb-6">
              {progress.currentPackage}
            </p>

            <div className="max-w-md mx-auto">
              <div className="flex justify-between text-sm text-surface-500 mb-2">
                <span>{t('degoogle.progressOf', { current: progress.current, total: progress.total })}</span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="h-3 bg-surface-200 dark:bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-accent-500 to-accent-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {currentInstallingPkg && installationProgress[currentInstallingPkg] !== undefined && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between text-[10px] text-surface-400 mb-1 px-1">
                    <span>{t('adb.install.transferring')}</span>
                    <span>{Math.round(installationProgress[currentInstallingPkg] * 100)}%</span>
                  </div>
                  <div className="h-1 bg-surface-200 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${installationProgress[currentInstallingPkg] * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-500" strokeWidth={1.5} />
            </motion.div>

            <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
              {t('degoogle.degooglingComplete')}
            </h2>
            <p className="text-surface-500 mb-8">
              {t('degoogle.packagesDisabledSuccess', { count: results.success.length })}
              {results.failed.length > 0 && `, ${t('degoogle.packagesFailed', { count: results.failed.length })}`}
            </p>

            {results.failed.length > 0 && (
              <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-left">
                <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                  {t('degoogle.packagesNotDisabled')}
                </p>
                <div className="space-y-1">
                  {results.failed.map(pkg => (
                    <p key={pkg} className="text-xs text-red-500 font-mono">{pkg}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button
                variant="secondary"
                onClick={resetWizard}
              >
                {t('degoogle.newDegoogle')}
              </Button>
              <Button
                onClick={() => setCurrentPage('debloater')}
              >
                {t('degoogle.goToDebloater')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal for High/Total levels */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title={t('degoogle.confirmDegoogle')}
        size="md"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-red-500/10">
            <AlertTriangle className="w-6 h-6 text-red-500" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-surface-900 dark:text-white font-medium mb-2">
              {t('degoogle.aboutToExecute', { level: t(`degoogle.levels.${selectedLevelConfig?.id}.name`) || '' })}
            </p>
            <p className="text-sm text-surface-500 mb-4">
              {t(`degoogle.levels.${selectedLevelConfig?.id}.warning`)}
            </p>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-600 dark:text-red-400">
                {t('degoogle.warningHighLevel')}
              </p>
            </div>
          </div>
        </div>

        <ModalActions>
          <Button
            variant="ghost"
            onClick={() => setShowConfirmModal(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setShowConfirmModal(false)
              executeDegoogle()
            }}
          >
            {t('degoogle.proceedAnyway')}
          </Button>
        </ModalActions>
      </Modal>
      {/* Admin Alternative Edit Modal */}
      {
        isAdmin && (
          <AlternativeEditModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false)
              setEditingAlternative(null)
            }}
            googlePackage={editingAlternative?.pkg || ''}
            googleName={editingAlternative?.name || ''}
            alternative={editingAlternative?.alt}
            onSaved={fetchCustomAlternatives}
          />
        )
      }
    </div >
  )
}

interface LevelCardProps {
  level: DegoogleLevelConfig
  installedCount: number
  isSelected: boolean
  onSelect: () => void
}

function LevelCard({ level, installedCount, isSelected, onSelect }: LevelCardProps) {
  const { t } = useTranslation()
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className={`
        w-full text-left glass-card p-5 transition-all
        ${isSelected
          ? 'ring-2 ring-accent-500 border-accent-500/50'
          : 'hover:border-surface-300 dark:hover:border-white/20'
        }
      `}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${level.bgColor}`}>
          <Leaf className={`w-6 h-6 ${level.color}`} strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-surface-900 dark:text-white">
              {t(`degoogle.levels.${level.id}.name`)}
            </h3>
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${level.bgColor} ${level.color}`}>
              {installedCount} {t('degoogle.packages')}
            </span>
          </div>
          <p className="text-sm text-surface-500 mb-3">
            {t(`degoogle.levels.${level.id}.description`)}
          </p>
          {t(`degoogle.levels.${level.id}.warning`) && (
            <p className={`text-xs ${level.color}`}>
              ⚠️ {t(`degoogle.levels.${level.id}.warning`)}
            </p>
          )}
        </div>
        <div className={`
          w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
          transition-all
          ${isSelected
            ? 'border-accent-500 bg-accent-500'
            : 'border-surface-300 dark:border-surface-600'
          }
        `}>
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-2 h-2 bg-white rounded-full"
            />
          )}
        </div>
      </div>
    </motion.button>
  )
}

interface AlternativeCardProps {
  app: FossApp
  isSelected: boolean
  onSelect: () => void
}

function AlternativeCard({ app, isSelected, onSelect }: AlternativeCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full p-3 rounded-xl border transition-all text-left
        ${isSelected
          ? 'bg-accent-500/10 border-accent-500/30 ring-1 ring-accent-500/30'
          : 'bg-surface-100 dark:bg-white/5 border-transparent hover:border-surface-300 dark:hover:border-white/20'
        }
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`
            w-4 h-4 rounded border flex items-center justify-center transition-all
            ${isSelected ? 'bg-accent-500 border-accent-500' : 'border-surface-300 dark:border-white/20'}
          `}>
            {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </div>
          <h4 className="font-medium text-surface-900 dark:text-white text-sm">
            {app.name}
          </h4>
        </div>
        <div className="flex gap-1">
          {app.fdroidUrl && (
            <a
              href={app.fdroidUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-1 rounded-lg hover:bg-surface-300 dark:hover:bg-white/10 transition-colors"
              title="F-Droid"
            >
              <ExternalLink className="w-3 h-3 text-surface-500" strokeWidth={1.5} />
            </a>
          )}
          {app.githubUrl && (
            <a
              href={app.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-1 rounded-lg hover:bg-surface-300 dark:hover:bg-white/10 transition-colors"
              title="GitHub"
            >
              <ExternalLink className="w-3 h-3 text-surface-500" strokeWidth={1.5} />
            </a>
          )}
        </div>
      </div>
      <p className="text-xs text-surface-500 mb-2 line-clamp-2">
        {app.description}
      </p>
      <div className="flex flex-wrap gap-1">
        {app.features?.slice(0, 2).map((feature, i) => (
          <span
            key={i}
            className="text-[9px] px-1.5 py-0.5 rounded bg-accent-500/10 text-accent-600 dark:text-accent-400"
          >
            {feature}
          </span>
        ))}
      </div>
    </button>
  )
}

