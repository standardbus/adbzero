/**
 * Mobile Sync Modal
 * Shown when a mobile audit is detected
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Smartphone, SmartphoneIcon, Terminal } from 'lucide-react'
import { useAdbStore } from '@/stores/adbStore'
import { useAdb } from '@/hooks/useAdb'
import { useTranslation } from '@/stores/i18nStore'
import { markMobileAuditExecuted } from '@/services/supabase'

export function MobileSyncModal() {
    const {
        mobileAuditDetected,
        currentMobileAudit,
        hasShownMobileAuditModal,
        setMobileAuditDetected,
        setHasShownMobileAuditModal
    } = useAdbStore()

    const { togglePackage } = useAdb()
    const { t } = useTranslation()
    const [isProcessing, setIsProcessing] = useState(false)
    const [currentPkg, setCurrentPkg] = useState('')

    const handleClose = () => {
        setMobileAuditDetected(false)
        setHasShownMobileAuditModal(true)
    }

    const handleApply = async () => {
        if (!currentMobileAudit) return

        setIsProcessing(true)

        // manifest_data structure: { audit_results: [ { package_id, ... } ] }
        const packages = currentMobileAudit.manifest_data.audit_results
            .filter((r: any) => r.recommendation === 'debloat')
            .map((r: any) => r.package_id)

        for (const pkg of packages) {
            setCurrentPkg(pkg)
            await togglePackage(pkg, false)
        }

        // Mark as executed in DB
        await markMobileAuditExecuted(currentMobileAudit.id)

        setIsProcessing(false)
        handleClose()
    }

    if (!mobileAuditDetected || hasShownMobileAuditModal || !currentMobileAudit) return null

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
                    <div className="bg-accent-500/10 border-b border-accent-500/20 p-6 flex items-center gap-4">
                        <div className="p-3 bg-accent-500/20 rounded-2xl">
                            <Smartphone className="w-8 h-8 text-accent-600 dark:text-accent-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-surface-900 dark:text-white">
                                {t('sync.mobileAuditDetected')}
                            </h2>
                            <p className="text-sm text-accent-700 dark:text-accent-400 font-medium">
                                {t('sync.mobileAuditDetectedDesc', { model: currentMobileAudit.device_model })}
                            </p>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-white/5 rounded-2xl border border-surface-200 dark:border-white/5 mb-6">
                            <SmartphoneIcon className="w-10 h-10 text-surface-400" />
                            <div>
                                <h4 className="font-bold text-surface-900 dark:text-white">{currentMobileAudit.device_model}</h4>
                                <p className="text-xs text-surface-500 uppercase tracking-widest">
                                    {new Date(currentMobileAudit.created_at).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <p className="text-sm text-surface-600 dark:text-surface-400 mb-8 leading-relaxed">
                            {t('sync.mobileAuditExplanation')}
                        </p>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                disabled={isProcessing}
                                onClick={handleApply}
                                className={`
                                    flex-1 px-8 py-4 bg-accent-600 hover:bg-accent-700 text-white font-semibold rounded-2xl 
                                    transition-all shadow-lg shadow-accent-600/20 flex items-center justify-center gap-2
                                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                {isProcessing ? (
                                    <>
                                        <Terminal className="w-5 h-5 animate-spin" />
                                        <span className="truncate max-w-[200px]">{currentPkg}...</span>
                                    </>
                                ) : (
                                    <>
                                        <Smartphone className="w-5 h-5" />
                                        <span>{t('sync.applyMobileDebloat')}</span>
                                    </>
                                )}
                            </button>
                            <button
                                disabled={isProcessing}
                                onClick={async () => {
                                    const { createCommunityListFromAudit } = useAdb()
                                    const success = await createCommunityListFromAudit(currentMobileAudit.id)
                                    if (success) {
                                        // Opt: maybe ask if they also want to apply it now,
                                        // but for now let's just close as the list is created.
                                        handleClose()
                                    }
                                }}
                                className="px-8 py-4 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-white font-semibold rounded-2xl transition-colors border border-surface-200 dark:border-white/10"
                            >
                                {t('community.createList')}
                            </button>
                            <button
                                disabled={isProcessing}
                                onClick={handleClose}
                                className="px-8 py-4 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-white font-semibold rounded-2xl transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
