import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Plus, Trash2, Globe, Github, Package, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/stores/i18nStore'
import { supabase } from '@/services/supabase'
import { useAppStore } from '@/stores/appStore'
import type { FossApp } from '@/data/foss-alternatives'

interface AlternativeEditModalProps {
    isOpen: boolean
    onClose: () => void
    googlePackage: string
    googleName: string
    alternative?: FossApp // If provided, we are editing. If not, we are adding.
    onSaved: () => void
}

export function AlternativeEditModal({
    isOpen,
    onClose,
    googlePackage,
    googleName,
    alternative,
    onSaved
}: AlternativeEditModalProps) {
    const { t } = useTranslation()
    const showToast = useAppStore(state => state.showToast)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState<Partial<FossApp>>({
        name: '',
        packageName: '',
        description: '',
        apkUrl: '',
        fdroidUrl: '',
        githubUrl: '',
        features: []
    })
    const [newFeature, setNewFeature] = useState('')

    useEffect(() => {
        if (isOpen) {
            if (alternative) {
                setFormData({ ...alternative })
            } else {
                setFormData({
                    name: '',
                    packageName: '',
                    description: '',
                    apkUrl: '',
                    fdroidUrl: '',
                    githubUrl: '',
                    features: []
                })
            }
        }
    }, [isOpen, alternative])

    const handleSave = async () => {
        if (!formData.name || !formData.packageName) {
            showToast({ type: 'error', title: 'Errore', message: 'Nome e Package Name sono obbligatori' })
            return
        }

        setIsSaving(true)
        try {
            // We store these in a new table 'foss_alternatives_overrides'
            // Or we can just use a generic 'foss_alternatives' table if we want to migrate everything to DB
            const { error } = await supabase
                .from('foss_alternatives_overrides')
                .upsert({
                    google_package: googlePackage,
                    package_name: formData.packageName,
                    name: formData.name,
                    description: formData.description,
                    apk_url: formData.apkUrl,
                    fdroid_url: formData.fdroidUrl,
                    github_url: formData.githubUrl,
                    features: formData.features,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'google_package, package_name'
                })

            if (error) throw error

            showToast({ type: 'success', title: t('admin.saved'), message: formData.name })
            onSaved()
            onClose()
        } catch (error) {
            console.error('Save error:', error)
            showToast({ type: 'error', title: t('admin.saveError'), message: 'Errore durante il salvataggio dell\'alternativa' })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!alternative || !confirm('Sei sicuro di voler eliminare questa alternativa?')) return

        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('foss_alternatives_overrides')
                .delete()
                .eq('google_package', googlePackage)
                .eq('package_name', alternative.packageName)

            if (error) throw error

            showToast({ type: 'success', title: 'Eliminato', message: alternative.name })
            onSaved()
            onClose()
        } catch (error) {
            console.error('Delete error:', error)
            showToast({ type: 'error', title: 'Errore', message: 'Impossibile eliminare l\'alternativa' })
        } finally {
            setIsSaving(false)
        }
    }

    const addFeature = () => {
        if (newFeature.trim()) {
            setFormData(prev => ({
                ...prev,
                features: [...(prev.features || []), newFeature.trim()]
            }))
            setNewFeature('')
        }
    }

    const removeFeature = (index: number) => {
        setFormData(prev => ({
            ...prev,
            features: prev.features?.filter((_, i) => i !== index)
        }))
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-surface-50 dark:bg-[#0A0A0B] rounded-3xl shadow-2xl overflow-hidden border border-white/10"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-accent-500/10 text-accent-500">
                                    <Package className="w-6 h-6" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                                        {alternative ? 'Modifica Alternativa' : 'Nuova Alternativa'}
                                    </h2>
                                    <p className="text-sm text-surface-500">
                                        Sostituzione per: <span className="font-mono text-accent-500">{googleName}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl hover:bg-white/5 text-surface-400 transition-colors"
                            >
                                <X className="w-6 h-6" strokeWidth={1.5} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                            Nome App
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="es. Firefox"
                                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-accent-500/50 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                            Package Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.packageName}
                                            onChange={e => setFormData(prev => ({ ...prev, packageName: e.target.value }))}
                                            placeholder="es. org.mozilla.firefox"
                                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-accent-500/50 outline-none font-mono text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                            Descrizione breve
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="Cosa fa l'app?"
                                            rows={4}
                                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-accent-500/50 outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Links */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
                                    <LinkIcon className="w-4 h-4" /> Link di Download
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium text-emerald-500 mb-2">
                                            <CheckCircle2 className="w-4 h-4" /> URL APK Diretto (Premium)
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.apkUrl}
                                            onChange={e => setFormData(prev => ({ ...prev, apkUrl: e.target.value }))}
                                            placeholder="L'URL che il browser scaricherà"
                                            className="w-full px-4 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 focus:ring-2 focus:ring-emerald-500/50 outline-none font-mono text-xs"
                                        />
                                        <p className="mt-1 text-[10px] text-surface-500">
                                            Link diretto al file .apk per l'installazione automatica.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium text-blue-500 mb-2">
                                            <Globe className="w-4 h-4" /> F-Droid URL
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.fdroidUrl}
                                            onChange={e => setFormData(prev => ({ ...prev, fdroidUrl: e.target.value }))}
                                            placeholder="Pagina F-Droid"
                                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-accent-500/50 outline-none font-mono text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-2">
                                            <Github className="w-4 h-4" /> GitHub URL
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.githubUrl}
                                            onChange={e => setFormData(prev => ({ ...prev, githubUrl: e.target.value }))}
                                            placeholder="Repository GitHub"
                                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-accent-500/50 outline-none font-mono text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                    Caratteristiche principali
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newFeature}
                                        onChange={e => setNewFeature(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addFeature()}
                                        placeholder="Esempio: No Ads"
                                        className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-accent-500/50 outline-none"
                                    />
                                    <Button onClick={addFeature} variant="ghost" className="h-[42px]">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(formData.features || []).map((feature, i) => (
                                        <span
                                            key={i}
                                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent-500/10 text-accent-500 border border-accent-500/20 text-xs"
                                        >
                                            {feature}
                                            <button onClick={() => removeFeature(i)} className="hover:text-red-500">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/5 bg-white/5 flex items-center justify-between">
                            {alternative ? (
                                <Button
                                    variant="ghost"
                                    onClick={handleDelete}
                                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                    disabled={isSaving}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Elimina
                                </Button>
                            ) : (
                                <div />
                            )}

                            <div className="flex items-center gap-3">
                                <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                                    Annulla
                                </Button>
                                <Button onClick={handleSave} disabled={isSaving}>
                                    <Save className="w-4 h-4" />
                                    {isSaving ? 'Salvataggio...' : 'Salva Alternativa'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
