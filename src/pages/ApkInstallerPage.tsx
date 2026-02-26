/**
 * APK Installer Page
 * Drag-and-drop or file picker for installing APKs
 * Follows Apple Human Interface Guidelines for web
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Upload,
    Package,
    CheckCircle2,
    XCircle,
    Loader2,
    Trash2,
    Smartphone,
    FileBox,
    AlertTriangle,
    Plus,
    Link,
    Globe,
    Download as DownloadIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAdb } from '@/hooks/useAdb'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/stores/i18nStore'
import { installApk } from '@/services/adb-client'

interface ApkFile {
    id: string
    file: File
    name: string
    size: number
    status: 'pending' | 'installing' | 'success' | 'error'
    progress: number
    error?: string
}

// Security: Whitelist of allowed domains for APK downloads
const ALLOWED_APK_DOMAINS = [
    'github.com',
    'raw.githubusercontent.com',
    'objects.githubusercontent.com',
    'f-droid.org',
    'apkmirror.com',
    'apkpure.com',
    'releases.mozilla.org',
] as const

// Max APK file size: 500MB
const MAX_APK_SIZE = 500 * 1024 * 1024

function isValidApkUrl(url: string): { valid: boolean; error?: string } {
    try {
        const parsed = new URL(url)

        // Must be HTTPS
        if (parsed.protocol !== 'https:') {
            return { valid: false, error: 'Only HTTPS URLs are allowed' }
        }

        // Check against allowed domains
        const isAllowed = ALLOWED_APK_DOMAINS.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        )

        if (!isAllowed) {
            return {
                valid: false,
                error: `Domain not allowed. Allowed: ${ALLOWED_APK_DOMAINS.join(', ')}`
            }
        }

        // Must look like an APK file
        if (!parsed.pathname.toLowerCase().endsWith('.apk')) {
            return { valid: false, error: 'URL must point to an APK file' }
        }

        return { valid: true }
    } catch {
        return { valid: false, error: 'Invalid URL format' }
    }
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ApkInstallerPage() {
    const { isConnected } = useAdb()
    const { showToast } = useAppStore()
    const { t } = useTranslation()

    const [files, setFiles] = useState<ApkFile[]>([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [isInstalling, setIsInstalling] = useState(false)
    const [installUrl, setInstallUrl] = useState('')
    const [isFetching, setIsFetching] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Not connected state
    if (!isConnected) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Smartphone className="w-16 h-16 mx-auto text-surface-400 mb-4" strokeWidth={1} />
                    <p className="text-surface-500">{t('apkInstaller.connectDevice')}</p>
                </div>
            </div>
        )
    }

    const addFiles = (newFiles: FileList | File[]) => {
        const apkFiles = Array.from(newFiles).filter(f => f.name.toLowerCase().endsWith('.apk'))

        if (apkFiles.length === 0) {
            showToast({ type: 'error', title: t('apkInstaller.invalidFile'), message: t('apkInstaller.onlyApk') })
            return
        }

        const mapped: ApkFile[] = apkFiles.map(f => ({
            id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file: f,
            name: f.name,
            size: f.size,
            status: 'pending',
            progress: 0,
        }))

        setFiles(prev => [...prev, ...mapped])
    }

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id))
    }

    const clearAll = () => {
        if (!isInstalling) setFiles([])
    }

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files)
        }
    }, [])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files)
            // Reset the input so re-selecting the same file triggers onChange
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleUrlInstall = async () => {
        // Security: Validate URL against whitelist
        const validation = isValidApkUrl(installUrl)
        if (!validation.valid) {
            showToast({
                type: 'error',
                title: t('apkInstaller.invalidUrl'),
                message: validation.error || t('apkInstaller.urlStartHttp')
            })
            return
        }

        setIsFetching(true)
        try {
            const response = await fetch(installUrl)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            // Security: Check Content-Type
            const contentType = response.headers.get('Content-Type')
            if (contentType && !contentType.includes('application/') && !contentType.includes('octet-stream')) {
                throw new Error('Invalid content type - expected application file')
            }

            // Security: Check Content-Length before downloading
            const contentLength = response.headers.get('Content-Length')
            if (contentLength && parseInt(contentLength, 10) > MAX_APK_SIZE) {
                throw new Error(`File too large (max ${MAX_APK_SIZE / 1024 / 1024}MB)`)
            }

            const blob = await response.blob()

            // Security: Validate actual blob size
            if (blob.size > MAX_APK_SIZE) {
                throw new Error(`File too large (max ${MAX_APK_SIZE / 1024 / 1024}MB)`)
            }

            // Try to get filename from Content-Disposition or URL
            let fileName = 'app.apk'
            const contentDisposition = response.headers.get('Content-Disposition')
            if (contentDisposition && contentDisposition.includes('filename=')) {
                fileName = contentDisposition.split('filename=')[1].split(';')[0].replace(/['"]/g, '')
            } else {
                const urlParts = installUrl.split('/')
                const lastPart = urlParts[urlParts.length - 1].split('?')[0]
                if (lastPart.toLowerCase().endsWith('.apk')) {
                    fileName = lastPart
                }
            }

            const file = new File([blob], fileName, { type: 'application/vnd.android.package-archive' })
            addFiles([file])
            setInstallUrl('')
            showToast({ type: 'success', title: t('apkInstaller.urlFetchSuccess'), message: t('apkInstaller.fileAddedToQueue') })
        } catch (error: any) {
            console.error('Fetch error:', error)
            showToast({
                type: 'error',
                title: t('apkInstaller.fetchError'),
                message: error.message.includes('Failed to fetch')
                    ? t('apkInstaller.corsError')
                    : error.message
            })
        } finally {
            setIsFetching(false)
        }
    }

    // Install all pending APKs sequentially
    const installAll = async () => {
        const pendingFiles = files.filter(f => f.status === 'pending')
        if (pendingFiles.length === 0) return

        setIsInstalling(true)

        for (const apkFile of pendingFiles) {
            // Mark as installing
            setFiles(prev => prev.map(f => f.id === apkFile.id ? { ...f, status: 'installing' as const, progress: 0 } : f))

            try {
                const buffer = await apkFile.file.arrayBuffer()
                const data = new Uint8Array(buffer)

                await installApk(data, (progress) => {
                    setFiles(prev => prev.map(f => f.id === apkFile.id ? { ...f, progress: Math.round(progress * 100) } : f))
                })

                setFiles(prev => prev.map(f => f.id === apkFile.id ? { ...f, status: 'success' as const, progress: 100 } : f))
            } catch (error: any) {
                setFiles(prev => prev.map(f => f.id === apkFile.id ? { ...f, status: 'error' as const, error: error.message || 'Unknown error' } : f))
            }
        }

        setIsInstalling(false)

        const updatedFiles = files
        const successCount = updatedFiles.filter(f => f.status === 'success').length
        const errorCount = updatedFiles.filter(f => f.status === 'error').length

        if (errorCount === 0) {
            showToast({ type: 'success', title: t('apkInstaller.installComplete'), message: t('apkInstaller.allInstalled', { count: pendingFiles.length }) })
        } else {
            showToast({ type: 'error', title: t('apkInstaller.installPartial'), message: t('apkInstaller.someErrors', { success: successCount, errors: errorCount }) })
        }
    }

    const pendingCount = files.filter(f => f.status === 'pending').length
    const hasFiles = files.length > 0

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto terminal-spacer">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
                            {t('apkInstaller.title')}
                        </h1>
                        <p className="text-surface-500 mt-1">
                            {t('apkInstaller.subtitle')}
                        </p>
                    </div>
                    {hasFiles && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAll}
                                disabled={isInstalling}
                                icon={<Trash2 className="w-4 h-4" />}
                            >
                                {t('apkInstaller.clearAll')}
                            </Button>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Drop Zone */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
            relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
            ${isDragOver
                            ? 'border-accent-500 bg-accent-500/5 dark:bg-accent-500/10 scale-[1.01]'
                            : 'border-surface-300 dark:border-white/10 hover:border-accent-500/50 hover:bg-surface-100/50 dark:hover:bg-white/[0.02]'
                        }
            ${hasFiles ? 'p-6' : 'p-12 sm:p-16'}
          `}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".apk"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    <div className="text-center">
                        <motion.div
                            animate={{
                                y: isDragOver ? -8 : 0,
                                scale: isDragOver ? 1.1 : 1,
                            }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                            <div className={`
                w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-colors duration-300
                ${isDragOver
                                    ? 'bg-accent-500/15 text-accent-500'
                                    : 'bg-surface-200/50 dark:bg-white/5 text-surface-400'
                                }
              `}>
                                <Upload className="w-7 h-7" strokeWidth={1.5} />
                            </div>
                        </motion.div>

                        <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-1">
                            {isDragOver ? t('apkInstaller.dropHere') : t('apkInstaller.dragDrop')}
                        </h3>
                        <p className="text-sm text-surface-500 mb-3">
                            {t('apkInstaller.orBrowse')}
                        </p>
                        <div className="flex items-center justify-center gap-1.5 text-xs text-surface-400">
                            <FileBox className="w-3.5 h-3.5" />
                            <span>{t('apkInstaller.apkOnly')}</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* URL Installation */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-6"
            >
                <Card variant="glass" className="p-4 sm:p-6 overflow-hidden relative">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-accent-500/10 text-accent-500 flex items-center justify-center shrink-0">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-surface-900 dark:text-white">
                                {t('apkInstaller.installFromUrl')}
                            </h3>
                            <p className="text-xs text-surface-500">
                                {t('apkInstaller.installFromUrlDesc')}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                            <input
                                type="url"
                                value={installUrl}
                                onChange={(e) => setInstallUrl(e.target.value)}
                                placeholder={t('apkInstaller.urlPlaceholder')}
                                className="w-full bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50 transition-all text-surface-900 dark:text-white"
                                onKeyDown={(e) => e.key === 'Enter' && handleUrlInstall()}
                            />
                        </div>
                        <Button
                            variant="primary"
                            onClick={handleUrlInstall}
                            disabled={!installUrl || isFetching}
                            loading={isFetching}
                            icon={<DownloadIcon className="w-4 h-4" />}
                            className="shrink-0"
                        >
                            {isFetching ? t('apkInstaller.downloading') : t('apkInstaller.download')}
                        </Button>
                    </div>

                    {/* CORS Hint */}
                    <p className="mt-3 text-[10px] text-surface-400 italic">
                        {t('apkInstaller.corsNote')}
                    </p>
                </Card>
            </motion.div>

            {/* File List */}
            <AnimatePresence mode="popLayout">
                {hasFiles && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 space-y-2"
                    >
                        {files.map((apkFile, index) => (
                            <motion.div
                                key={apkFile.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20, height: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card variant="glass" className="p-4">
                                    <div className="flex items-center gap-3">
                                        {/* Icon */}
                                        <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
                      ${apkFile.status === 'success'
                                                ? 'bg-emerald-500/10 text-emerald-500'
                                                : apkFile.status === 'error'
                                                    ? 'bg-red-500/10 text-red-500'
                                                    : apkFile.status === 'installing'
                                                        ? 'bg-accent-500/10 text-accent-500'
                                                        : 'bg-surface-200/50 dark:bg-white/5 text-surface-400'
                                            }
                    `}>
                                            {apkFile.status === 'installing' ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : apkFile.status === 'success' ? (
                                                <CheckCircle2 className="w-5 h-5" />
                                            ) : apkFile.status === 'error' ? (
                                                <XCircle className="w-5 h-5" />
                                            ) : (
                                                <Package className="w-5 h-5" strokeWidth={1.5} />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                                                {apkFile.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-surface-500">{formatFileSize(apkFile.size)}</span>
                                                {apkFile.status === 'installing' && (
                                                    <span className="text-xs font-mono text-accent-500">{apkFile.progress}%</span>
                                                )}
                                                {apkFile.status === 'success' && (
                                                    <span className="text-xs text-emerald-500 font-medium">{t('apkInstaller.installed')}</span>
                                                )}
                                                {apkFile.status === 'error' && (
                                                    <span className="text-xs text-red-500 truncate" title={apkFile.error}>
                                                        {apkFile.error}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Progress bar */}
                                            {apkFile.status === 'installing' && (
                                                <div className="mt-2 h-1 rounded-full bg-surface-200 dark:bg-white/10 overflow-hidden">
                                                    <motion.div
                                                        className="h-full rounded-full bg-accent-500"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${apkFile.progress}%` }}
                                                        transition={{ duration: 0.3 }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        {apkFile.status === 'pending' && !isInstalling && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFile(apkFile.id) }}
                                                className="p-2 rounded-lg hover:bg-surface-200/50 dark:hover:bg-white/5 text-surface-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        ))}

                        {/* Add More + Install Button */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between pt-4"
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isInstalling}
                                icon={<Plus className="w-4 h-4" />}
                            >
                                {t('apkInstaller.addMore')}
                            </Button>

                            <Button
                                variant="primary"
                                onClick={installAll}
                                disabled={pendingCount === 0}
                                loading={isInstalling}
                                icon={<Upload className="w-4 h-4" />}
                            >
                                {isInstalling
                                    ? t('apkInstaller.installing')
                                    : t('apkInstaller.installAll', { count: pendingCount })
                                }
                            </Button>
                        </motion.div>

                        {/* Warning */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20"
                        >
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] leading-relaxed text-surface-600 dark:text-amber-500/80">
                                {t('apkInstaller.warning')}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
