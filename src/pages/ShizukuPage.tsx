/**
 * Shizuku Page - Refactored
 * Installation, setup, and advanced features powered by Shizuku
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
    Zap,
    Download,
    Play,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ExternalLink,
    Smartphone,
    Shield,
    Package,
    Unlock,
    Terminal,
    Sparkles,
    Loader2
} from 'lucide-react'
import { useAdb } from '@/hooks/useAdb'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/stores/i18nStore'
import { Button } from '@/components/ui/Button'
import { SectionToggle } from '@/components/ui/SectionToggle'
import { QRCode } from '@/components/ui/QRCode'
import { getPlayStoreBadgePath } from '@/lib/play-store-badge'

// Shizuku URLs
const SHIZUKU_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api'

// Shizuku status types
type ShizukuStatus = 'not_installed' | 'installed_not_running' | 'running' | 'checking'

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
}

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
}

export function ShizukuPage() {
    const { shell } = useAdb()
    const showToast = useAppStore((state) => state.showToast)
    const { t, language } = useTranslation()

    // Core state
    const [shizukuStatus, setShizukuStatus] = useState<ShizukuStatus>('checking')
    const [loadingAction, setLoadingAction] = useState<string | null>(null)
    const [expandedSection, setExpandedSection] = useState<string | null>('installation')

    // Check Shizuku status - verifies if the actual Shizuku binder service is running
    // Returns the detected status for use by the polling logic
    const checkShizukuStatus = useCallback(async (): Promise<ShizukuStatus> => {
        try {
            // Check if Shizuku app is installed
            const installed = await shell('pm list packages moe.shizuku.privileged.api')
            if (!installed.stdout?.includes('moe.shizuku.privileged.api')) {
                setShizukuStatus('not_installed')
                return 'not_installed'
            }

            // Check if Shizuku binder service is actually running
            // The script 'sh start.sh' registers a binder service that we can verify
            // Method 1: Check for the actual Shizuku server process (not just the app)
            const serverCheck = await shell('ps -A 2>/dev/null | grep -E "shizuku_server|app_process.*shizuku"')
            if (serverCheck.stdout && serverCheck.stdout.trim().length > 0) {
                setShizukuStatus('running')
                return 'running'
            }

            // Method 2: Try to check if Shizuku service responds
            // Use service list to check for Shizuku binder
            const binderCheck = await shell('service list 2>/dev/null | grep -i shizuku')
            if (binderCheck.stdout && binderCheck.stdout.includes('shizuku')) {
                setShizukuStatus('running')
                return 'running'
            }

            // Method 3: Check for the Shizuku user service (more reliable on newer Android)
            const userServiceCheck = await shell('dumpsys activity services moe.shizuku.privileged.api 2>/dev/null | grep -i "ServiceRecord"')
            if (userServiceCheck.stdout && userServiceCheck.stdout.includes('ServiceRecord')) {
                // Service record exists, but we need to verify it's actually the server
                const serverRunning = await shell('cat /proc/*/cmdline 2>/dev/null | tr "\\0" " " | grep -i "shizuku" | grep -v "grep"')
                if (serverRunning.stdout && serverRunning.stdout.includes('shizuku')) {
                    setShizukuStatus('running')
                    return 'running'
                }
            }

            // If none of the above succeeded, Shizuku is installed but not running
            setShizukuStatus('installed_not_running')
            return 'installed_not_running'
        } catch {
            setShizukuStatus('not_installed')
            return 'not_installed'
        }
    }, [shell])

    // Automatic status polling - checks every 3 seconds until Shizuku is running
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null
        let isMounted = true

        const startPolling = async () => {
            // Initial check
            const initialStatus = await checkShizukuStatus()

            // If already running, no need to poll
            if (initialStatus === 'running' || !isMounted) {
                return
            }

            // Start polling every 3 seconds
            intervalId = setInterval(async () => {
                if (!isMounted) {
                    if (intervalId) clearInterval(intervalId)
                    return
                }

                const currentStatus = await checkShizukuStatus()

                // Stop polling once Shizuku is running
                if (currentStatus === 'running') {
                    if (intervalId) {
                        clearInterval(intervalId)
                        intervalId = null
                    }
                }
            }, 3000) // Check every 3 seconds
        }

        startPolling()

        // Cleanup on unmount
        return () => {
            isMounted = false
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [checkShizukuStatus])

    // Open Shizuku download page
    const downloadShizuku = useCallback(() => {
        window.open('https://github.com/RikkaApps/Shizuku/releases', '_blank')
        showToast({
            type: 'info',
            title: t('shizuku.downloadStarted'),
            message: t('shizuku.installManually')
        })
    }, [showToast, t])

    // Open Play Store on device for Shizuku
    const openPlayStoreOnDevice = useCallback(async () => {
        setLoadingAction('play_store')
        try {
            // Try opening Play Store with Shizuku package directly on the device
            const methods = [
                'am start -a android.intent.action.VIEW -d "market://details?id=moe.shizuku.privileged.api"',
                'am start -n com.android.vending/.AssetBrowserActivity -d "market://details?id=moe.shizuku.privileged.api"',
                'am start -a android.intent.action.VIEW -d "https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api"'
            ]

            for (const method of methods) {
                const result = await shell(method)
                if (result.exitCode === 0) {
                    showToast({
                        type: 'success',
                        title: t('shizuku.playStoreOpened'),
                        message: t('shizuku.installFromStore')
                    })
                    return
                }
            }

            // Fallback: open in browser
            window.open('https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api', '_blank')
        } catch {
            window.open('https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api', '_blank')
        } finally {
            setLoadingAction(null)
        }
    }, [shell, showToast, t])

    // Start Shizuku using the universal command
    // This command supports both Play Store and GitHub versions of Shizuku
    const startShizuku = useCallback(async () => {
        setLoadingAction('start_shizuku')
        try {
            // Universal command that works on both Shizuku versions:
            // 1. GitHub version: Uses start.sh in /sdcard/Android/data/
            // 2. Play Store version: Uses libshizuku.so from the APK
            //const universalCommand = `P=\`pm path moe.shizuku.privileged.api | cut -d: -f2 | tr -d '\\r' | sed 's/base.apk//'\`; S='/sdcard/Android/data/moe.shizuku.privileged.api/start.sh'; if [ -f "$S" ]; then sh "$S"; else L=\`ls \${P}lib/*/libshizuku.so 2>/dev/null | head -n 1 | tr -d '\\r'\`; if [ -z "$L" ]; then echo 'ERROR: Open Shizuku on phone at least once'; exit 1; else $L; fi; fi`
            const universalCommand = `monkey -p moe.shizuku.privileged.api -c android.intent.category.LAUNCHER 1; sleep 3; sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh || pm path moe.shizuku.privileged.api | cut -d: -f2 | tr -d '\r' | sed 's/base.apk/lib\/arm64\/libshizuku.so/' | xargs sh`

            const result = await shell(universalCommand)

            if (result.exitCode === 0) {
                showToast({
                    type: 'success',
                    title: t('shizuku.started'),
                    message: t('shizuku.startedDesc')
                })
                setShizukuStatus('running')
                // Re-check status after a short delay to confirm
                setTimeout(() => checkShizukuStatus(), 2000)
            } else {
                // Check if the error is about opening Shizuku first
                if (result.stdout?.includes('ERROR:') || result.stderr?.includes('ERROR:')) {
                    throw new Error(t('shizuku.openAppFirst'))
                }
                throw new Error(result.stderr || t('shizuku.commandFailed'))
            }
        } catch (error) {
            showToast({
                type: 'error',
                title: t('shizuku.startFailed'),
                message: String(error)
            })
        } finally {
            setLoadingAction(null)
        }
    }, [shell, showToast, t, checkShizukuStatus])

    // Copy universal start command to clipboard (for manual use if needed)
    const copyStartScript = useCallback(() => {
        const script = `adb shell "P=\\\`pm path moe.shizuku.privileged.api | cut -d: -f2 | tr -d '\\r' | sed 's/base.apk//'\\\`; S='/sdcard/Android/data/moe.shizuku.privileged.api/start.sh'; if [ -f \\"\\$S\\" ]; then sh \\"\\$S\\"; else L=\\\`ls \\\${P}lib/*/libshizuku.so 2>/dev/null | head -n 1 | tr -d '\\r'\\\`; if [ -z \\"\\$L\\" ]; then echo ""; else \\$L; fi; fi"`
        navigator.clipboard.writeText(script)
        showToast({
            type: 'success',
            title: t('shizuku.scriptCopied'),
            message: t('shizuku.universalScript')
        })
    }, [showToast, t])

    // Status badge component - memoized to prevent re-renders
    const StatusBadge = useMemo(() => {
        const configs: Record<ShizukuStatus, { color: string; icon: typeof CheckCircle2; text: string }> = {
            not_installed: {
                color: 'bg-red-500/10 text-red-500 border-red-500/20',
                icon: XCircle,
                text: t('shizuku.notInstalled')
            },
            installed_not_running: {
                color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                icon: AlertTriangle,
                text: t('shizuku.installedNotRunning')
            },
            running: {
                color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                icon: CheckCircle2,
                text: t('shizuku.running')
            },
            checking: {
                color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                icon: Zap,
                text: t('shizuku.checking')
            }
        }

        const config = configs[shizukuStatus]
        const Icon = config.icon

        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${config.color}`}>
                <Icon className="w-4 h-4" strokeWidth={1.5} />
                <span>{config.text}</span>
            </div>
        )
    }, [shizukuStatus, t])

    // Section toggle handler
    const handleSectionToggle = useCallback((id: string) => {
        setExpandedSection(prev => prev === id ? null : id)
    }, [])

    return (
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-5xl mx-auto terminal-spacer">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-6"
                >
                    {/* Header */}
                    <motion.div variants={item} className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-0.5 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-sm flex-shrink-0 overflow-hidden">
                                    <img
                                        src="/shizuku-icon.png"
                                        alt="Shizuku"
                                        className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-[1.125rem]"
                                    />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">
                                        Shizuku
                                    </h1>
                                    <p className="text-surface-500 dark:text-surface-400">
                                        {t('shizuku.description')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {StatusBadge}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={<ExternalLink className="w-4 h-4" strokeWidth={1.5} />}
                                    onClick={() => window.open('https://shizuku.rikka.app/', '_blank')}
                                >
                                    {t('shizuku.learnMore')}
                                </Button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Main Content */}
                    <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Installation & Setup */}
                        <div className="lg:col-span-2 space-y-4">

                            {/* Installation Section */}
                            <SectionToggle
                                id="installation"
                                title={t('shizuku.installation')}
                                icon={Download}
                                isExpanded={expandedSection === 'installation'}
                                onToggle={() => handleSectionToggle('installation')}
                            >
                                <div className="space-y-4">
                                    {/* Step 1: Install Shizuku */}
                                    <div className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-300 ${(shizukuStatus === 'installed_not_running' || shizukuStatus === 'running')
                                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                                        : 'bg-white/5'
                                        }`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${(shizukuStatus === 'installed_not_running' || shizukuStatus === 'running')
                                            ? 'bg-emerald-500/20 text-emerald-500'
                                            : 'bg-accent-500/20 text-accent-500'
                                            }`}>
                                            {(shizukuStatus === 'installed_not_running' || shizukuStatus === 'running') ? (
                                                <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                                            ) : (
                                                <span className="font-bold">1</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 min-h-[2rem]">
                                                <h4 className={`font-medium transition-colors ${(shizukuStatus === 'installed_not_running' || shizukuStatus === 'running')
                                                    ? 'text-emerald-500'
                                                    : 'text-surface-900 dark:text-white'
                                                    }`}>
                                                    {t('shizuku.step1Title')}
                                                </h4>
                                                {(shizukuStatus === 'installed_not_running' || shizukuStatus === 'running') && (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                                                )}
                                            </div>

                                            {!(shizukuStatus === 'installed_not_running' || shizukuStatus === 'running') && (
                                                <div className="space-y-3 mt-1">
                                                    <p className="text-sm text-surface-500">
                                                        {t('shizuku.step1Desc')}
                                                    </p>

                                                    {/* QR Code and Actions Layout */}
                                                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                                                        {/* QR Code */}
                                                        <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface-800 dark:bg-surface-900 shadow-sm flex-shrink-0">
                                                            <QRCode
                                                                data={SHIZUKU_PLAY_STORE_URL}
                                                                size={100}
                                                                darkColor="#ffffff"
                                                                lightColor="#1f2937"
                                                                alt={t('shizuku.scanQRToInstall')}
                                                            />
                                                            <img
                                                                src={getPlayStoreBadgePath(language)}
                                                                alt="Get it on Google Play"
                                                                className="h-8 w-auto"
                                                            />
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex flex-col gap-2 flex-1">
                                                            <p className="text-xs text-surface-400 mb-1">
                                                                {t('shizuku.orUseButtons')}
                                                            </p>
                                                            <div className="flex flex-wrap gap-2">
                                                                <Button
                                                                    variant="primary"
                                                                    size="sm"
                                                                    icon={<Download className="w-4 h-4" strokeWidth={1.5} />}
                                                                    onClick={downloadShizuku}
                                                                >
                                                                    {t('shizuku.download')}
                                                                </Button>
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    icon={<Smartphone className="w-4 h-4" strokeWidth={1.5} />}
                                                                    onClick={openPlayStoreOnDevice}
                                                                    loading={loadingAction === 'play_store'}
                                                                >
                                                                    {t('shizuku.openPlayStore')}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Step 2: Start Shizuku */}
                                    <div className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-300 ${shizukuStatus === 'running'
                                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                                        : 'bg-white/5'
                                        }`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${shizukuStatus === 'running'
                                            ? 'bg-emerald-500/20 text-emerald-500'
                                            : 'bg-accent-500/20 text-accent-500'
                                            }`}>
                                            {shizukuStatus === 'running' ? (
                                                <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                                            ) : (
                                                <span className="font-bold">2</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 min-h-[2rem]">
                                                <h4 className={`font-medium transition-colors ${shizukuStatus === 'running'
                                                    ? 'text-emerald-500'
                                                    : 'text-surface-900 dark:text-white'
                                                    }`}>
                                                    {t('shizuku.step2Title')}
                                                </h4>
                                                {shizukuStatus === 'running' && (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                                                )}
                                            </div>

                                            {shizukuStatus !== 'running' && (
                                                <div className="space-y-3 mt-1">
                                                    <p className="text-sm text-surface-500">
                                                        {t('shizuku.step2Desc')}
                                                    </p>

                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            icon={loadingAction === 'start_shizuku' ?
                                                                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> :
                                                                <Play className="w-4 h-4" strokeWidth={1.5} />
                                                            }
                                                            onClick={startShizuku}
                                                            loading={loadingAction === 'start_shizuku'}
                                                            disabled={shizukuStatus === 'not_installed'}
                                                        >
                                                            {t('shizuku.startShizuku')}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<Terminal className="w-4 h-4" strokeWidth={1.5} />}
                                                            onClick={copyStartScript}
                                                        >
                                                            {t('shizuku.copyScript')}
                                                        </Button>

                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Step 3: Grant Permissions */}
                                    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5">
                                        <div className="w-8 h-8 rounded-full bg-accent-500/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-accent-500 font-bold">3</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 min-h-[2rem]">
                                                <h4 className="font-medium text-surface-900 dark:text-white">
                                                    {t('shizuku.step3Title')}
                                                </h4>
                                            </div>
                                            <p className="text-sm text-surface-500 mt-1">
                                                {t('shizuku.step3Desc')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </SectionToggle>

                            {/* Features Section */}
                            <SectionToggle
                                id="features"
                                title={t('shizuku.advancedFeatures')}
                                icon={Sparkles}
                                isExpanded={expandedSection === 'features'}
                                onToggle={() => handleSectionToggle('features')}
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        { icon: Unlock, title: t('shizuku.features.grantPermissions'), desc: t('shizuku.features.grantPermissionsDesc') },
                                        { icon: Package, title: t('shizuku.features.appBackup'), desc: t('shizuku.features.appBackupDesc') },
                                        { icon: Shield, title: t('shizuku.features.disableBloat'), desc: t('shizuku.features.disableBloatDesc') },
                                        { icon: Terminal, title: t('shizuku.features.adbCommands'), desc: t('shizuku.features.adbCommandsDesc') }
                                    ].map((feature, index) => (
                                        <div key={index} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-lg bg-accent-500/10">
                                                    <feature.icon className="w-5 h-5 text-accent-500" strokeWidth={1.5} />
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-surface-900 dark:text-white text-sm">
                                                        {feature.title}
                                                    </h4>
                                                    <p className="text-xs text-surface-500 mt-1">
                                                        {feature.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SectionToggle>
                        </div>

                        {/* Right Column - Status & Info */}
                        <div className="space-y-4">

                            {/* What is Shizuku */}
                            <div className="glass-card p-4">
                                <h3 className="font-semibold text-surface-900 dark:text-white mb-3">
                                    {t('shizuku.whatIsShizuku')}
                                </h3>
                                <p className="text-sm text-surface-500 dark:text-surface-400 leading-relaxed">
                                    {t('shizuku.whatIsShizukuDesc')}
                                </p>
                            </div>

                            {/* Benefits */}
                            <div className="glass-card p-4">
                                <h3 className="font-semibold text-surface-900 dark:text-white mb-3">
                                    {t('shizuku.benefits')}
                                </h3>
                                <ul className="space-y-2">
                                    {[
                                        t('shizuku.benefit1'),
                                        t('shizuku.benefit2'),
                                        t('shizuku.benefit3'),
                                        t('shizuku.benefit4')
                                    ].map((benefit, index) => (
                                        <li key={index} className="flex items-start gap-2 text-sm text-surface-500">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                                            <span>{benefit}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    )
}
