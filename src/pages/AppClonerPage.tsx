/**
 * App Cloner Page
 * Allows users to clone apps using native Managed Profiles (Work Profile)
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Copy,
    Search,
    Package,
    ArrowRight,
    Trash2,
    AlertTriangle,
    CheckCircle2,
    Briefcase,
    Zap,
    Grid,
    Info,
    Settings,
    Scan,
    ShieldCheck,
    Loader2
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useTranslation } from '@/stores/i18nStore'
import { useAdb } from '@/hooks/useAdb'
import {
    getPackageDatabase,
    type PackageDefinition
} from '@/services/package-database'
import {
    getAppIcon,
    getCachedIcon,
    getCachedLabel,
    loadAllFromCache,
    loadFromSupabase,
    extractAllLabelsFromDevice
} from '@/services/app-icons'
import { getAppSettings } from '@/config/app'
import type { PackageInfo, SetupProgressCallback } from '@/services/adb-client'

interface EnrichedPackage extends PackageInfo {
    definition?: PackageDefinition
    displayName: string
}

interface SetupProgress {
    phase: 'settings' | 'scanning' | 'debloating' | 'done'
    message: string
    currentPkg?: string
    current?: number
    total?: number
    removed?: number
    kept?: number
}

// ─── Skeleton loader for app list ───
function AppListSkeleton() {
    return (
        <div className="divide-y divide-surface-100 dark:divide-white/5">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-surface-200 dark:bg-white/10" />
                    <div className="flex-1 space-y-2">
                        <div
                            className="h-4 rounded-lg bg-surface-200 dark:bg-white/10"
                            style={{ width: `${45 + Math.random() * 35}%` }}
                        />
                        <div
                            className="h-2.5 rounded bg-surface-100 dark:bg-white/5"
                            style={{ width: `${55 + Math.random() * 30}%` }}
                        />
                    </div>
                    <div className="w-16 h-8 rounded-lg bg-surface-200 dark:bg-white/10" />
                </div>
            ))}
        </div>
    )
}

// ─── Setup progress overlay ───
function SetupOverlay({ progress }: { progress: SetupProgress }) {
    const phaseIcon = {
        settings: <Settings className="w-6 h-6" />,
        scanning: <Scan className="w-6 h-6" />,
        debloating: <ShieldCheck className="w-6 h-6" />,
        done: <CheckCircle2 className="w-6 h-6" />,
    }

    const phaseColor = {
        settings: 'text-blue-500',
        scanning: 'text-amber-500',
        debloating: 'text-rose-500',
        done: 'text-emerald-500',
    }

    const phaseBg = {
        settings: 'bg-blue-500/10',
        scanning: 'bg-amber-500/10',
        debloating: 'bg-rose-500/10',
        done: 'bg-emerald-500/10',
    }

    const phaseGlow = {
        settings: 'shadow-blue-500/20',
        scanning: 'shadow-amber-500/20',
        debloating: 'shadow-rose-500/20',
        done: 'shadow-emerald-500/20',
    }

    const percentage = progress.total && progress.current
        ? Math.round((progress.current / progress.total) * 100)
        : 0

    return (
        <Card className="p-12 flex flex-col items-center justify-center text-center min-h-[400px] relative overflow-hidden">
            {/* Background animated gradient */}
            <motion.div
                className="absolute inset-0 opacity-[0.03]"
                animate={{
                    background: [
                        'radial-gradient(circle at 20% 50%, var(--accent-color, #6366f1) 0%, transparent 50%)',
                        'radial-gradient(circle at 80% 50%, var(--accent-color, #6366f1) 0%, transparent 50%)',
                        'radial-gradient(circle at 50% 20%, var(--accent-color, #6366f1) 0%, transparent 50%)',
                        'radial-gradient(circle at 20% 50%, var(--accent-color, #6366f1) 0%, transparent 50%)',
                    ]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />

            {/* Phase icon */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={progress.phase}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.3, type: 'spring' }}
                    className={`w-20 h-20 rounded-2xl ${phaseBg[progress.phase]} ${phaseColor[progress.phase]} flex items-center justify-center mb-6 relative shadow-xl ${phaseGlow[progress.phase]}`}
                >
                    {progress.phase !== 'done' && (
                        <motion.div
                            className={`absolute inset-0 rounded-2xl ${phaseBg[progress.phase]}`}
                            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    )}
                    {phaseIcon[progress.phase]}
                </motion.div>
            </AnimatePresence>

            {/* Phase title */}
            <AnimatePresence mode="wait">
                <motion.h2
                    key={progress.message}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-lg font-bold text-surface-900 dark:text-white mb-2"
                >
                    {progress.message}
                </motion.h2>
            </AnimatePresence>

            {/* Progress bar for debloating */}
            {progress.phase === 'debloating' && progress.total && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm mt-4 space-y-3"
                >
                    {/* Package name being processed */}
                    {progress.currentPkg && (
                        <motion.div
                            key={progress.currentPkg}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 justify-center"
                        >
                            <Loader2 className="w-3 h-3 text-rose-500 animate-spin" />
                            <span className="text-xs font-mono text-surface-400 truncate max-w-[280px]">
                                {progress.currentPkg}
                            </span>
                        </motion.div>
                    )}

                    {/* Progress bar */}
                    <div className="relative h-2 rounded-full bg-surface-200 dark:bg-white/10 overflow-hidden">
                        <motion.div
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-500 to-red-400"
                            initial={{ width: '0%' }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.3 }}
                        />
                        {/* Shimmer effect */}
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between text-xs text-surface-500">
                        <span>{progress.current} / {progress.total}</span>
                        <span>{percentage}%</span>
                    </div>

                    {/* Live counters */}
                    <div className="flex items-center justify-center gap-6 mt-2">
                        <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-surface-500">
                                <span className="font-bold text-surface-900 dark:text-white">{progress.removed ?? 0}</span> removed
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-surface-500">
                                <span className="font-bold text-surface-900 dark:text-white">{progress.kept ?? 0}</span> kept
                            </span>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Scanning animation */}
            {progress.phase === 'scanning' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 mt-4"
                >
                    <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                            <motion.div
                                key={i}
                                className="w-2 h-2 rounded-full bg-amber-500"
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                            />
                        ))}
                    </div>
                    {progress.total && (
                        <span className="text-sm text-surface-500">
                            {progress.total} packages found
                        </span>
                    )}
                </motion.div>
            )}

            {/* Settings phase pulsing dots */}
            {progress.phase === 'settings' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-1 mt-4"
                >
                    {[0, 1, 2].map(i => (
                        <motion.div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-blue-500"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                    ))}
                </motion.div>
            )}

            {/* Done animation */}
            {progress.phase === 'done' && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-6 mt-4"
                >
                    <div className="flex items-center gap-1.5 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="text-surface-500">
                            <span className="font-bold text-surface-900 dark:text-white">{progress.removed ?? 0}</span> removed
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-surface-500">
                            <span className="font-bold text-surface-900 dark:text-white">{progress.kept ?? 0}</span> kept
                        </span>
                    </div>
                </motion.div>
            )}
        </Card>
    )
}

// ─── Main page component ───
export function AppClonerPage() {
    const { t } = useTranslation()
    const {
        packages,
        packagesLoading,
        loadUsers,
        createCloneProfile,
        deleteUserProfile,
        cloneAppToUser,
        loadPackages,
        isDemoMode,
        isConnected
    } = useAdb()

    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [cloningPkg, setCloningPkg] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [showSystemApps, setShowSystemApps] = useState(false)
    const [showNukeConfirm, setShowNukeConfirm] = useState(false)
    const [isNuking, setIsNuking] = useState(false)

    // Setup progress state
    const [isSettingUp, setIsSettingUp] = useState(false)
    const [setupProgress, setSetupProgress] = useState<SetupProgress | null>(null)

    // State for real names and icons
    const [packageDb, setPackageDb] = useState<Record<string, PackageDefinition>>({})
    const [realLabels, setRealLabels] = useState<Record<string, string>>({})
    const [realIcons, setRealIcons] = useState<Record<string, string>>({})
    const [cacheLoaded, setCacheLoaded] = useState(false)

    // Check for managed profile
    const managedProfile = useMemo(() => {
        return users.find(u => u.isManaged)
    }, [users])

    const fetchUsers = async () => {
        try {
            const list = await loadUsers()
            setUsers(list)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isConnected) {
            fetchUsers()
            loadPackages()
        }
    }, [isConnected])

    // Load IndexedDB cache on mount
    useEffect(() => {
        loadAllFromCache().then(() => setCacheLoaded(true))
    }, [])

    // Background loading of labels and icons
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
            // Load definitions
            getPackageDatabase(packageNames).then(db => {
                if (!cancelled) setPackageDb(db.packages)
            })

            // Load from Supabase
            await loadFromSupabase(packageNames)
            updateCachedData()

            // Extract labels from device - respect global setting
            if (getAppSettings().enableDeviceScraping) {
                await extractAllLabelsFromDevice(packageNames.slice(0, 50), () => {
                    if (!cancelled) updateCachedData()
                })

                // Load some icons
                const toLoadIcons = packageNames.filter(pkg => !getCachedIcon(pkg)).slice(0, 20)
                for (const pkg of toLoadIcons) {
                    if (cancelled) break
                    await getAppIcon(pkg)
                    updateCachedData()
                }
            }
        }

        loadData()
        return () => { cancelled = true }
    }, [packages, cacheLoaded])

    // Enrich packages
    const enrichedPackages = useMemo((): EnrichedPackage[] => {
        return packages.map(pkg => {
            const definition = packageDb[pkg.packageName]
            const deviceLabel = realLabels[pkg.packageName]
            const adminLabel = definition?.descriptions?.['label']

            let displayName = pkg.packageName
            if (adminLabel) displayName = adminLabel
            else if (deviceLabel) displayName = deviceLabel
            else displayName = pkg.packageName.split('.').pop() || pkg.packageName

            return {
                ...pkg,
                definition,
                displayName
            }
        })
    }, [packages, packageDb, realLabels])

    const handleProgressUpdate: SetupProgressCallback = useCallback((progress) => {
        setSetupProgress(progress as SetupProgress)
    }, [])

    const handleCreateProfile = async () => {
        setIsSettingUp(true)
        setSetupProgress({ phase: 'settings', message: 'Initializing...' })

        const userId = await createCloneProfile('ClonedApps', handleProgressUpdate)

        // Brief pause on "done" to show final stats
        if (userId) {
            await new Promise(r => setTimeout(r, 1500))
            await fetchUsers()
        }

        setIsSettingUp(false)
        setSetupProgress(null)
    }

    const handleNuke = async () => {
        if (!managedProfile) return
        setIsNuking(true)
        const success = await deleteUserProfile(managedProfile.id)
        if (success) {
            await fetchUsers()
            setShowNukeConfirm(false)
        }
        setIsNuking(false)
    }

    const handleClone = async (packageName: string) => {
        if (!managedProfile) return
        setCloningPkg(packageName)
        await cloneAppToUser(packageName, managedProfile.id)
        setCloningPkg(null)
    }

    const filteredPackages = useMemo(() => {
        return enrichedPackages
            .filter(pkg => {
                const matchesSearch =
                    pkg.packageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    pkg.displayName.toLowerCase().includes(searchTerm.toLowerCase())

                // Default: show only user apps (!pkg.isSystem)
                // If showSystemApps is true, show everything
                const matchesType = showSystemApps ? true : !pkg.isSystem
                return matchesSearch && matchesType
            })
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
    }, [enrichedPackages, searchTerm, showSystemApps])

    // Whether the app list is still loading (first load)
    const isLoadingApps = packagesLoading || (packages.length === 0 && loading && managedProfile)

    if (!isConnected && !isDemoMode) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 pb-20">
                <div className="w-20 h-20 rounded-3xl bg-surface-100 dark:bg-white/5 flex items-center justify-center mb-6">
                    <Copy className="w-10 h-10 text-surface-400" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
                    {t('appCloner.title')}
                </h1>
                <p className="text-surface-500 max-w-sm">
                    {t('appCloner.connectDevice')}
                </p>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto p-6 pb-32">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-accent-500/10 text-accent-500">
                            <Copy className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
                            {t('appCloner.title')}
                        </h1>
                    </div>
                    <p className="text-surface-500 max-w-2xl">
                        {t('appCloner.subtitle')}
                    </p>
                </div>

                {managedProfile && !isSettingUp && (
                    <Button
                        variant="secondary"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/20"
                        onClick={() => setShowNukeConfirm(true)}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('appCloner.nukeProfile')}
                    </Button>
                )}
            </div>

            {/* Status Card */}
            <AnimatePresence mode="wait">
                {/* ─── Setup in progress: show animated overlay ─── */}
                {isSettingUp && setupProgress ? (
                    <motion.div
                        key="setup-progress"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        <SetupOverlay progress={setupProgress} />
                    </motion.div>

                    /* ─── No profile: show setup prompt ─── */
                ) : !managedProfile ? (
                    <motion.div
                        key="no-profile"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        <Card className="p-12 text-center border-dashed border-2 flex flex-col items-center justify-center bg-accent-500/[0.02]">
                            <div className="w-20 h-20 rounded-full bg-accent-500/10 flex items-center justify-center mb-6 relative">
                                <Briefcase className="w-10 h-10 text-accent-500" />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 rounded-full bg-accent-500"
                                />
                            </div>
                            <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">
                                {t('appCloner.noProfile')}
                            </h2>
                            <p className="text-surface-500 mb-8 max-w-md">
                                {t('appCloner.subtitle')}
                            </p>
                            <Button
                                size="lg"
                                className="px-8 shadow-xl shadow-accent-500/20"
                                onClick={handleCreateProfile}
                                loading={loading && !isSettingUp}
                            >
                                <Zap className="w-5 h-5 mr-2 fill-current" />
                                {t('appCloner.setupProfile')}
                            </Button>
                        </Card>
                    </motion.div>

                    /* ─── Profile exists: show apps ─── */
                ) : (
                    <motion.div
                        key="profile-ready"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Profile Info Card */}
                            <div className="lg:col-span-1 space-y-6">
                                <Card className="p-6 bg-emerald-500/[0.02] border-emerald-500/20">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-bold text-surface-900 dark:text-white">
                                            {t('appCloner.profileReady')}
                                        </h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-surface-500">Profile Name</span>
                                            <span className="text-surface-900 dark:text-white font-medium">{managedProfile.name}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-surface-500">User ID</span>
                                            <span className="text-surface-900 dark:text-white font-medium">{managedProfile.id}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-surface-500">Status</span>
                                            <span className="flex items-center gap-1 text-emerald-500 font-medium">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                </Card>

                                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3">
                                    <Info className="w-5 h-5 text-blue-500 shrink-0" />
                                    <div className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                                        {t('appCloner.existingProfileWarning')}
                                    </div>
                                </div>
                            </div>

                            {/* Apps List Container */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                                    <div className="relative w-full sm:max-w-xs">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                        <input
                                            type="text"
                                            placeholder={t('appCloner.searchApps')}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-surface-100 dark:bg-white/5 border border-transparent focus:border-accent-500 outline-none transition-all text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div
                                                onClick={() => setShowSystemApps(!showSystemApps)}
                                                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${showSystemApps ? 'bg-accent-500 border-accent-500' : 'border-surface-300 dark:border-white/10'}`}
                                            >
                                                {showSystemApps && <Grid className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-xs font-medium text-surface-500 group-hover:text-surface-700 dark:group-hover:text-surface-300">
                                                {t('appCloner.showSystemApps')}
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <Card className="overflow-hidden border-surface-200 dark:border-white/5">
                                    {isLoadingApps ? (
                                        <AppListSkeleton />
                                    ) : (
                                        <div className="max-h-[60vh] overflow-y-auto divide-y divide-surface-100 dark:divide-white/5 scrollbar-thin scrollbar-thumb-surface-200 dark:scrollbar-thumb-white/10">
                                            {filteredPackages.map((pkg) => (
                                                <motion.div
                                                    key={pkg.packageName}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="p-4 flex items-center gap-4 hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-colors group"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-white/5 flex items-center justify-center overflow-hidden group-hover:bg-accent-500/10 transition-colors">
                                                        {realIcons[pkg.packageName] ? (
                                                            <img
                                                                src={realIcons[pkg.packageName]}
                                                                alt=""
                                                                className="w-full h-full object-cover p-1.5"
                                                            />
                                                        ) : (
                                                            <Package className="w-5 h-5 text-surface-400 group-hover:text-accent-500" strokeWidth={1.5} />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                                                            {pkg.displayName}
                                                        </h4>
                                                        <p className="text-[10px] text-surface-400 font-mono truncate">
                                                            {pkg.packageName}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleClone(pkg.packageName)}
                                                        loading={cloningPkg === pkg.packageName}
                                                    >
                                                        {t('common.copy')}
                                                        <ArrowRight className="w-3 h-3 ml-1.5" />
                                                    </Button>
                                                </motion.div>
                                            ))}
                                            {filteredPackages.length === 0 && !isLoadingApps && (
                                                <div className="p-12 text-center text-surface-500">
                                                    {t('common.noResults')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Nuke Confirmation Modal */}
            <Modal
                isOpen={showNukeConfirm}
                onClose={() => !isNuking && setShowNukeConfirm(false)}
                title={t('appCloner.nukeProfile')}
            >
                <div className="p-6 pt-0">
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex gap-3 mb-6">
                        <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                        <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed font-medium">
                            {t('appCloner.nukeWarning')}
                        </p>
                    </div>

                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="secondary"
                            onClick={() => setShowNukeConfirm(false)}
                            disabled={isNuking}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleNuke}
                            loading={isNuking}
                        >
                            {t('appCloner.nukeProfile')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
