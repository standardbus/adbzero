/**
 * Sync Update Modal
 * Mostrato quando viene rilevato un aggiornamento di sistema e alcuni pacchetti sono ritornati
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Check, ShieldCheck } from 'lucide-react'
import { useAdbStore } from '@/stores/adbStore'
import { useAdb } from '@/hooks/useAdb'
import { useTranslation } from '@/stores/i18nStore'

export function SyncUpdateModal() {
    const { systemUpdateDetected, returnedPackages, hasShownUpdateModal, setSystemUpdateDetected, setHasShownUpdateModal } = useAdbStore()
    const { togglePackage } = useAdb()
    const { t } = useTranslation()
    const [selectedPackages, setSelectedPackages] = useState<string[]>(returnedPackages)
    const [isProcessing, setIsProcessing] = useState(false)
    const [currentPkg, setCurrentPkg] = useState('')

    const handleClose = () => {
        setSystemUpdateDetected(false)
        setHasShownUpdateModal(true)
    }

    const handleApply = async () => {
        setIsProcessing(true)
        let processed = 0

        for (const pkg of selectedPackages) {
            setCurrentPkg(pkg)
            await togglePackage(pkg, false)
            processed++
        }

        setIsProcessing(false)
        handleClose()
    }

    const toggleSelection = (pkgName: string) => {
        setSelectedPackages(prev =>
            prev.includes(pkgName)
                ? prev.filter(p => p !== pkgName)
                : [...prev, pkgName]
        )
    }

    if (!systemUpdateDetected || hasShownUpdateModal) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={handleClose}
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-2xl bg-white dark:bg-surface-900 rounded-3xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-amber-500/10 border-b border-amber-500/20 p-6 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 rounded-2xl">
                            <RefreshCw className="w-8 h-8 text-amber-600 dark:text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-surface-900 dark:text-white">
                                {t('sync.updateDetected')}
                            </h2>
                            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                                {t('sync.updateDetectedDesc')}
                            </p>
                        </div>
                    </div>

                    <div className="p-8">
                        <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-500" />
                            {t('sync.returnedPackages')} ({returnedPackages.length})
                        </h3>

                        <p className="text-sm text-surface-500 mb-6">
                            {t('sync.selectToDisable')}
                        </p>

                        {/* Package List */}
                        <div className="max-h-60 overflow-y-auto space-y-2 mb-8 pr-2">
                            {returnedPackages.map(pkg => (
                                <div
                                    key={pkg}
                                    onClick={() => !isProcessing && toggleSelection(pkg)}
                                    className={`
                    flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer
                    ${selectedPackages.includes(pkg)
                                            ? 'bg-indigo-500/5 border-indigo-500/30'
                                            : 'bg-surface-50 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700'
                                        }
                  `}
                                >
                                    <div className={`
                    w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                    ${selectedPackages.includes(pkg)
                                            ? 'bg-indigo-500 border-indigo-500 text-white'
                                            : 'border-surface-300 dark:border-surface-600'
                                        }
                  `}>
                                        {selectedPackages.includes(pkg) && <Check className="w-4 h-4" />}
                                    </div>
                                    <span className="text-sm font-mono text-surface-700 dark:text-surface-300 truncate">
                                        {pkg}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                disabled={isProcessing || selectedPackages.length === 0}
                                onClick={handleApply}
                                className={`
                  flex-1 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl 
                  transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2
                  ${(isProcessing || selectedPackages.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                            >
                                {isProcessing ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        <span>{currentPkg}...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-5 h-5" />
                                        <span>{t('sync.reapplyDebloat')} ({selectedPackages.length})</span>
                                    </>
                                )}
                            </button>
                            <button
                                disabled={isProcessing}
                                onClick={handleClose}
                                className="px-8 py-4 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-white font-semibold rounded-2xl transition-colors"
                            >
                                {t('sync.keepChanges')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
