/**
 * Advanced Description Edit Modal
 * Modal per modificare nome, descrizioni, icone e etichette dei pacchetti
 * Include protezione dati admin e fetching dal Play Store
 * Solo per amministratori
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Save, Globe, AlertCircle, Check, Tag, Shield,
  Image, ExternalLink, Trash2, Plus, ShieldCheck, RefreshCw,
  Upload, Download as DownloadIcon
} from 'lucide-react'
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  LANGUAGE_FLAGS,
  type SupportedLanguage
} from '@/services/i18n'
import { supabase } from '@/services/supabase'
import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/stores/i18nStore'
import { type RemovalImpact } from '@/services/package-database'

// Etichette predefinite
const PREDEFINED_LABELS = [
  'dangerous', 'ads', 'tracker', 'spyware', 'bloatware',
  'essential', 'battery_drain', 'privacy_risk',
  'google', 'samsung', 'xiaomi', 'facebook', 'safe', 'caution'
] as const

// Security: URL validation for icon fetch
const ALLOWED_ICON_DOMAINS = [
  'play-lh.googleusercontent.com',
  'lh3.googleusercontent.com',
  'i.imgur.com',
  'raw.githubusercontent.com',
  'cdn.jsdelivr.net',
] as const

function isValidIconUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') return false
    // Check against allowed domains
    return ALLOWED_ICON_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain))
  } catch {
    return false
  }
}

// Security: Sanitize text extracted from external sources (Play Store)
function sanitizeExternalText(text: string, maxLength: number = 200): string {
  if (!text || typeof text !== 'string') return ''
  // Remove HTML tags, decode entities, trim whitespace
  const cleaned = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
  // Limit length
  return cleaned.slice(0, maxLength)
}

// Security: Validate label format
function isValidLabel(label: string): boolean {
  if (!label || typeof label !== 'string') return false
  const normalized = label.toLowerCase().trim().replace(/\s+/g, '_')
  // Only allow alphanumeric and underscores, 2-30 chars
  return /^[a-z][a-z0-9_]{1,29}$/.test(normalized)
}

// Colori per le etichette
const LABEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  dangerous: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' },
  ads: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30' },
  tracker: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30' },
  spyware: { bg: 'bg-red-600/10', text: 'text-red-600', border: 'border-red-600/30' },
  bloatware: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
  essential: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
  battery_drain: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30' },
  privacy_risk: { bg: 'bg-pink-500/10', text: 'text-pink-500', border: 'border-pink-500/30' },
  google: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
  samsung: { bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/30' },
  xiaomi: { bg: 'bg-orange-600/10', text: 'text-orange-600', border: 'border-orange-600/30' },
  facebook: { bg: 'bg-blue-600/10', text: 'text-blue-600', border: 'border-blue-600/30' },
  safe: { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30' },
  caution: { bg: 'bg-yellow-600/10', text: 'text-yellow-600', border: 'border-yellow-600/30' },
  // Default for custom labels
  default: { bg: 'bg-surface-500/10', text: 'text-surface-500', border: 'border-surface-500/30' }
}

interface DescriptionEditModalProps {
  isOpen: boolean
  onClose: () => void
  packageName: string
  currentDescriptions: Record<string, string>
  currentAppLabel?: string
  currentIcon?: string
  currentLabels?: string[]
  currentRemoval?: RemovalImpact
  onSaved?: () => void
}

export function DescriptionEditModal({
  isOpen,
  onClose,
  packageName,
  currentDescriptions,
  currentAppLabel,
  currentIcon,
  currentLabels = [],
  currentRemoval = 'Advanced',
  onSaved
}: DescriptionEditModalProps) {
  const { t } = useTranslation()
  const showToast = useAppStore((state) => state.showToast)

  // State
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>('en')
  const [descriptions, setDescriptions] = useState<Record<string, string>>({})
  const [appLabel, setAppLabel] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [iconBase64, setIconBase64] = useState<string | null>(null)
  const [iconUrl, setIconUrl] = useState('')
  const [isDragOverIcon, setIsDragOverIcon] = useState(false)
  const iconFileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const translationFileInputRef = useRef<HTMLInputElement>(null)
  const [removal, setRemoval] = useState<RemovalImpact>('Advanced')
  const [adminVerified, setAdminVerified] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingPlayStore, setIsFetchingPlayStore] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'labels' | 'icon'>('info')
  const [newLabelInput, setNewLabelInput] = useState('')
  const [storeLookupDone, setStoreLookupDone] = useState(false)

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      setDescriptions({ ...currentDescriptions })

      // Funzione per validare se un nome è valido (non spazzatura dal database)
      const isValid = (name: any) => {
        if (!name || typeof name !== 'string') return false
        const invalid = ['null', '"null"', 'undefined', '"undefined"', 'Not Found', 'not found', 'NOT FOUND']
        return !invalid.includes(name.trim()) && name.trim().length > 0
      }

      const initialLabel = [currentAppLabel, currentDescriptions['label']].find(isValid) || ''
      setAppLabel(initialLabel)

      setLabels([...currentLabels])
      setIconBase64(currentIcon || null)
      setRemoval(currentRemoval)

      // Store lookup status
      setStoreLookupDone(!!currentDescriptions['_store_lookup'])

      setHasChanges(false)
      setActiveTab('info')

      // Fetch admin_verified status from database
      loadAdminVerifiedStatus()
    }
  }, [isOpen, currentDescriptions, currentAppLabel, currentLabels, currentIcon])

  const loadAdminVerifiedStatus = async () => {
    try {
      const { data } = await supabase
        .from('uad_packages')
        .select('admin_verified, icon_base64, removal')
        .eq('package_name', packageName)
        .single()

      if (data) {
        setAdminVerified(data.admin_verified || false)
        if (data.icon_base64 && !currentIcon) {
          setIconBase64(data.icon_base64)
        }
        if (data.removal) {
          setRemoval(data.removal as RemovalImpact)
        }
      }
    } catch {
      // Package might not exist yet
    }
  }

  const handleAdminVerifiedChange = (value: boolean) => {
    setAdminVerified(value)
    setHasChanges(true)
  }

  const handleStoreLookupChange = (value: boolean) => {
    setStoreLookupDone(value)
    setHasChanges(true)
  }

  const handleAppLabelChange = (value: string) => {
    setAppLabel(value)
    setHasChanges(true)
  }

  const handleAddLabel = (label: string) => {
    const normalizedLabel = label.toLowerCase().trim().replace(/\s+/g, '_')

    // Security: Validate label format
    if (!isValidLabel(normalizedLabel)) {
      showToast({
        type: 'error',
        title: 'Invalid label',
        message: 'Labels must be 2-30 characters, alphanumeric with underscores'
      })
      setNewLabelInput('')
      return
    }

    // Limit total labels
    if (labels.length >= 10) {
      showToast({
        type: 'warning',
        title: 'Too many labels',
        message: 'Maximum 10 labels per package'
      })
      setNewLabelInput('')
      return
    }

    if (!labels.includes(normalizedLabel)) {
      setLabels(prev => [...prev, normalizedLabel])
      setHasChanges(true)
    }
    setNewLabelInput('')
  }

  const handleRemoveLabel = (label: string) => {
    setLabels(prev => prev.filter(l => l !== label))
    setHasChanges(true)
  }

  const handleLoadIconFromUrl = async () => {
    const trimmedUrl = iconUrl.trim()
    if (!trimmedUrl) return

    // Security: Validate URL against whitelist
    if (!isValidIconUrl(trimmedUrl)) {
      showToast({
        type: 'error',
        title: t('admin.iconError'),
        message: 'URL must be HTTPS from allowed domains (Google, Imgur, GitHub)'
      })
      return
    }

    try {
      // Fetch image and convert to base64
      const response = await fetch(trimmedUrl)

      // Validate content type
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Invalid content type - must be an image')
      }

      const blob = await response.blob()

      // Limit file size (500KB max)
      if (blob.size > 500 * 1024) {
        throw new Error('Image too large (max 500KB)')
      }

      const reader = new FileReader()

      reader.onloadend = () => {
        const base64 = reader.result as string
        setIconBase64(base64)
        setHasChanges(true)
        setIconUrl('')
        showToast({
          type: 'success',
          title: t('admin.iconLoaded'),
          message: ''
        })
      }

      reader.readAsDataURL(blob)
    } catch (e) {
      console.error('Error loading icon:', e)
      showToast({
        type: 'error',
        title: t('admin.iconError'),
        message: String(e)
      })
    }
  }

  const handleRemoveIcon = () => {
    setIconBase64(null)
    setHasChanges(true)
  }

  // --- Icon upload from file ---
  const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
  const MAX_ICON_SIZE = 500 * 1024

  const handleIconFileSelect = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      showToast({ type: 'error', title: t('admin.iconError'), message: t('admin.iconInvalidType') })
      return
    }
    if (file.size > MAX_ICON_SIZE) {
      showToast({ type: 'error', title: t('admin.iconError'), message: t('admin.iconTooLarge') })
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setIconBase64(reader.result as string)
      setHasChanges(true)
      showToast({ type: 'success', title: t('admin.iconLoaded'), message: '' })
    }
    reader.onerror = () => {
      showToast({ type: 'error', title: t('admin.iconError'), message: 'Failed to read file' })
    }
    reader.readAsDataURL(file)
  }

  const handleIconDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverIcon(true)
  }, [])

  const handleIconDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverIcon(false)
  }, [])

  const handleIconDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverIcon(false)
    if (e.dataTransfer.files.length > 0) {
      handleIconFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleIconInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleIconFileSelect(e.target.files[0])
      if (iconFileInputRef.current) iconFileInputRef.current.value = ''
    }
  }

  // --- Export/Import translations ---
  const handleExportTranslations = () => {
    const exportData: Record<string, unknown> = {
      format: 'adbloater-translations-v1',
      package_name: packageName,
      app_name: appLabel,
      descriptions: {} as Record<string, string>
    }
    const descs: Record<string, string> = {}
    for (const lang of SUPPORTED_LANGUAGES) {
      descs[lang] = descriptions[lang] || ''
    }
    exportData.descriptions = descs

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${packageName}-translations.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportTranslations = (file: File) => {
    if (file.size > 100 * 1024) {
      showToast({ type: 'error', title: t('admin.importError'), message: t('admin.importTooLarge') })
      return
    }
    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        if (!text) throw new Error('Empty file')
        const data = JSON.parse(text)

        if (data.format !== 'adbloater-translations-v1') {
          throw new Error(t('admin.importInvalidFormat'))
        }

        if (data.package_name && data.package_name !== packageName) {
          if (!confirm(t('admin.importPackageMismatch', { file: data.package_name, current: packageName }))) {
            setIsImporting(false)
            return
          }
        }

        if (!data.descriptions || typeof data.descriptions !== 'object') {
          throw new Error(t('admin.importMissingDescriptions'))
        }

        if (data.app_name && typeof data.app_name === 'string') {
          const sanitized = sanitizeExternalText(data.app_name, 150)
          if (sanitized) setAppLabel(sanitized)
        }

        const newDescriptions = { ...descriptions }
        let importedCount = 0
        for (const lang of SUPPORTED_LANGUAGES) {
          if (data.descriptions[lang] && typeof data.descriptions[lang] === 'string') {
            const sanitized = sanitizeExternalText(data.descriptions[lang], 2000)
            if (sanitized) {
              newDescriptions[lang] = sanitized
              importedCount++
            }
          }
        }

        setDescriptions(newDescriptions)
        setHasChanges(true)
        showToast({ type: 'success', title: t('admin.importSuccess'), message: t('admin.importCount', { count: importedCount }) })
      } catch (err: any) {
        showToast({ type: 'error', title: t('admin.importError'), message: err.message || 'Failed to parse file' })
      } finally {
        setIsImporting(false)
      }
    }
    reader.onerror = () => {
      showToast({ type: 'error', title: t('admin.importError'), message: 'Failed to read file' })
      setIsImporting(false)
    }
    reader.readAsText(file)
  }

  const handleTranslationFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImportTranslations(e.target.files[0])
      if (translationFileInputRef.current) translationFileInputRef.current.value = ''
    }
  }

  const handleDescriptionChange = (value: string) => {
    setDescriptions(prev => ({
      ...prev,
      [selectedLang]: value
    }))
    setHasChanges(true)
  }

  // Fetch data from Play Store
  const fetchFromPlayStore = useCallback(async () => {
    setIsFetchingPlayStore(true)

    try {
      // Use CORS proxy to fetch Play Store page
      // Prioritize proxies that handle redirects correctly
      const proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://thingproxy.freeboard.io/fetch/',
      ]

      const playStoreUrl = `https://play.google.com/store/apps/details?id=${packageName}&hl=en`
      let success = false

      for (const proxy of proxies) {
        if (success) break

        try {
          console.log(`Trying proxy: ${proxy}`)
          const response = await fetch(proxy + encodeURIComponent(playStoreUrl))

          if (!response.ok) {
            console.warn(`Proxy ${proxy} returned ${response.status}`)
            continue
          }

          const html = await response.text()

          // Check if we got a valid Play Store page
          if (html.includes('We\'re sorry, the requested URL was not found') || html.includes('id="error-section"')) {
            console.warn('App not found on Play Store (404 content)')
            continue
          }

          // Extract app name with robust patterns
          let name = ''

          // 1. Try H1 with itemprop (Standard)
          const h1Match = html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/i)
          if (h1Match && h1Match[1]) name = h1Match[1]

          // 2. Try Standard H1
          if (!name) {
            const h1Simple = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
            if (h1Simple && h1Simple[1]) name = h1Simple[1]
          }

          // 3. Try Title Tag (Very robust fallback)
          // Format: "App Name - Apps on Google Play"
          if (!name) {
            const titleMatch = html.match(/<title>([^<\-]+)(?:-|&ndash;|–)\s*Apps on Google Play<\/title>/i)
            if (titleMatch && titleMatch[1]) name = titleMatch[1].trim()
          }

          if (name) {
            // Security: Sanitize extracted name to prevent XSS
            name = sanitizeExternalText(name, 150)
            if (!name) continue // Skip if sanitization results in empty string
            console.log(`Found app name: ${name}`)

            // Extract icon
            // Looking for generic icon patterns or specific itemprop="image"
            const iconMatch = html.match(/<img[^>]+src="([^"]+)"[^>]+alt="Icon image"/i) ||
              html.match(/<img[^>]+src="([^"]+)"[^>]+itemprop="image"/i) ||
              html.match(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*T75of[^"]*"/i) // Class often used for icons

            // Calculate changes
            let iconFound = false
            let iconUrlFound = ''

            if (iconMatch && iconMatch[1]) {
              iconFound = true
              iconUrlFound = iconMatch[1]
              // Decode HTML entities if needed (simple check)
              if (iconUrlFound.startsWith('&') || iconUrlFound.includes('&amp;')) {
                const doc = new DOMParser().parseFromString(iconUrlFound, "text/html");
                iconUrlFound = doc.documentElement.textContent || iconUrlFound;
              }
            }

            // Ask user if they want to overwrite
            if (appLabel && appLabel !== name) {
              if (!confirm(`${t('admin.overwriteWithPlayStore')}\n\nCurrent: ${appLabel}\nPlay Store: ${name}`)) {
                setIsFetchingPlayStore(false)
                return
              }
            }

            setAppLabel(name)

            // If icon found, load it
            if (iconFound && iconUrlFound) {
              try {
                // Fetch image via proxy to avoid CORS
                // Use the same proxy that worked for the page
                const imgResponse = await fetch(proxy + encodeURIComponent(iconUrlFound))
                const blob = await imgResponse.blob()
                const reader = new FileReader()

                reader.onloadend = () => {
                  const base64 = reader.result as string
                  setIconBase64(base64)
                }
                reader.readAsDataURL(blob)
              } catch (e) {
                console.warn('Could not load icon from Play Store', e)
              }
            }

            setHasChanges(true)

            showToast({
              type: 'success',
              title: t('admin.playStoreSuccess'),
              message: name + (iconFound ? ' + Icon' : '')
            })

            success = true
            setIsFetchingPlayStore(false)
            return
          }
        } catch (e) {
          console.warn(`Proxy ${proxy} failed:`, e)
          continue
        }
      }

      // If we got here, no proxy worked or app not found
      if (!success) {
        showToast({
          type: 'warning',
          title: t('admin.playStoreNotFound'),
          message: packageName
        })
      }

    } catch (e) {
      console.error('Play Store fetch error:', e)
      showToast({
        type: 'error',
        title: t('admin.playStoreError'),
        message: String(e)
      })
    } finally {
      setIsFetchingPlayStore(false)
    }
  }, [packageName, appLabel, t, showToast])

  const handleSave = async () => {
    setIsSaving(true)

    try {
      // Prepare descriptions with label and store lookup status
      const descriptionsToSave = { ...descriptions }
      if (appLabel.trim()) {
        descriptionsToSave['label'] = appLabel.trim()
      }

      if (storeLookupDone) {
        descriptionsToSave['_store_lookup'] = 'done'
      } else {
        delete descriptionsToSave['_store_lookup']
      }

      // Upsert to database
      const { error } = await supabase
        .from('uad_packages')
        .upsert({
          package_name: packageName,
          description: descriptionsToSave,
          labels: labels.length > 0 ? labels : null,
          icon_base64: iconBase64,
          removal: removal,
          admin_verified: adminVerified,
          admin_modified_at: new Date().toISOString(),
          is_from_uad: false
        }, {
          onConflict: 'package_name'
        })

      if (error) {
        throw error
      }

      showToast({
        type: 'success',
        title: t('admin.saved'),
        message: appLabel.trim()
          ? t('admin.updatedNameAndDesc', { pkg: packageName })
          : t('admin.updatedDesc', { pkg: packageName })
      })

      setHasChanges(false)
      onSaved?.()
      onClose()
    } catch (error) {
      console.error('Save error:', error)
      showToast({
        type: 'error',
        title: t('admin.saveError'),
        message: t('admin.cannotSave')
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getLabelColor = (label: string) => {
    return LABEL_COLORS[label] || LABEL_COLORS.default
  }

  const getLabelTranslation = (label: string): string => {
    const commonLabels = t('admin.commonLabels') as Record<string, string>
    return commonLabels[label] || label.replace(/_/g, ' ')
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl max-h-[90vh] overflow-hidden bg-white dark:bg-surface-800 rounded-2xl shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-500/10">
                <Globe className="w-5 h-5 text-accent-500" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold text-surface-900 dark:text-white">
                  {t('admin.editApp')}
                </h2>
                <p className="text-xs text-surface-500 font-mono">
                  {packageName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Admin Verified Badge */}
              {adminVerified && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {t('admin.adminVerified')}
                  </span>
                </div>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-surface-500" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-surface-200 dark:border-white/10 px-6 flex-shrink-0">
            {(['info', 'labels', 'icon'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  px-4 py-3 text-sm font-medium transition-colors relative
                  ${activeTab === tab
                    ? 'text-accent-500'
                    : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                  }
                `}
              >
                {tab === 'info' && (
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4" strokeWidth={1.5} />
                    {t('admin.appName')} & {t('admin.descriptionSelectLang').split(' ')[0]}
                  </span>
                )}
                {tab === 'labels' && (
                  <span className="flex items-center gap-2">
                    <Tag className="w-4 h-4" strokeWidth={1.5} />
                    {t('admin.labels')}
                    {labels.length > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-accent-500/20 text-accent-500 rounded-full">
                        {labels.length}
                      </span>
                    )}
                  </span>
                )}
                {tab === 'icon' && (
                  <span className="flex items-center gap-2">
                    <Image className="w-4 h-4" strokeWidth={1.5} />
                    {t('admin.appIcon')}
                  </span>
                )}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            {/* Tab: Info */}
            {activeTab === 'info' && (
              <div className="p-6 space-y-6">
                {/* App Name with Play Store button */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" strokeWidth={1.5} />
                        {t('admin.appName')}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchFromPlayStore}
                        loading={isFetchingPlayStore}
                        icon={<ExternalLink className="w-3 h-3" strokeWidth={1.5} />}
                        className="text-xs"
                      >
                        {t('admin.fetchFromPlayStore')}
                      </Button>
                    </div>
                  </label>
                  <input
                    type="text"
                    value={appLabel}
                    onChange={(e) => handleAppLabelChange(e.target.value)}
                    placeholder={t('admin.appNamePlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-white/10
                      bg-surface-50 dark:bg-white/5 text-surface-900 dark:text-white
                      placeholder:text-surface-400
                      focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500
                      transition-all"
                  />
                  <p className="mt-1.5 text-xs text-surface-500">
                    {t('admin.appNameDesc')}
                  </p>
                </div>

                {/* Language Selector */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    {t('admin.descriptionSelectLang')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const hasContent = !!descriptions[lang]?.trim()
                      const isSelected = selectedLang === lang

                      return (
                        <button
                          key={lang}
                          onClick={() => setSelectedLang(lang)}
                          className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                            ${isSelected
                              ? 'bg-accent-500/10 border-accent-500/30 text-accent-600 dark:text-accent-400'
                              : 'border-surface-200 dark:border-white/10 hover:border-accent-500/30'
                            }
                          `}
                        >
                          <span className="text-lg">{LANGUAGE_FLAGS[lang]}</span>
                          <span className="text-sm font-medium">{LANGUAGE_NAMES[lang]}</span>
                          {hasContent && (
                            <Check className="w-3 h-3 text-emerald-500" strokeWidth={2} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Description Editor */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    {t('admin.descriptionIn', { lang: LANGUAGE_NAMES[selectedLang], flag: LANGUAGE_FLAGS[selectedLang] })}
                  </label>
                  <textarea
                    value={descriptions[selectedLang] || ''}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    placeholder={t('admin.enterDescriptionIn', { lang: LANGUAGE_NAMES[selectedLang] })}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-white/10 
                      bg-surface-50 dark:bg-white/5 text-surface-900 dark:text-white
                      placeholder:text-surface-400 resize-none
                      focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500
                      transition-all"
                  />

                  {/* Warning for empty English */}
                  {!descriptions['en']?.trim() && (
                    <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t('admin.fallbackWarning')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Export/Import Translations */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/10">
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-accent-500" strokeWidth={1.5} />
                      {t('admin.exportImportTranslations')}
                    </div>
                  </label>
                  <p className="text-xs text-surface-500 mb-3">
                    {t('admin.exportImportDesc')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleExportTranslations}
                      icon={<DownloadIcon className="w-4 h-4" strokeWidth={1.5} />}
                    >
                      {t('admin.exportBtn')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => translationFileInputRef.current?.click()}
                      loading={isImporting}
                      icon={<Upload className="w-4 h-4" strokeWidth={1.5} />}
                    >
                      {t('admin.importBtn')}
                    </Button>
                    <input
                      ref={translationFileInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleTranslationFileChange}
                    />
                  </div>
                </div>

                {/* Removal Level Selection */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/10">
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-accent-500" strokeWidth={1.5} />
                      {t('admin.removalLevel')}
                    </div>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['Recommended', 'Advanced', 'Expert', 'Unsafe'] as RemovalImpact[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => {
                          setRemoval(level)
                          setHasChanges(true)
                        }}
                        className={`
                          px-3 py-2 rounded-lg border text-xs font-medium transition-all
                          ${removal === level
                            ? 'bg-accent-500 text-white border-accent-500 shadow-lg shadow-accent-500/20'
                            : 'bg-white dark:bg-surface-700 border-surface-200 dark:border-white/10 text-surface-600 dark:text-surface-400 hover:border-accent-500/50'
                          }
                        `}
                      >
                        {t(`filters.${level.toLowerCase()}`)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-surface-500">
                    {t('admin.removalLevelDesc')}
                  </p>
                </div>

                {/* Protection Toggle */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <Shield className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h4 className="font-medium text-surface-900 dark:text-white">
                          {t('admin.protection')}
                        </h4>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {t('admin.adminVerifiedDesc')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdminVerifiedChange(!adminVerified)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors
                        ${adminVerified ? 'bg-emerald-500' : 'bg-surface-300 dark:bg-white/20'}
                      `}
                    >
                      <div
                        className={`
                          absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                          ${adminVerified ? 'translate-x-7' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>
                  {adminVerified && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
                      {t('admin.protectedPackage')}
                    </div>
                  )}
                </div>

                {/* Store Lookup Toggle (Admin only to reset) */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <RefreshCw className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h4 className="font-medium text-surface-900 dark:text-white">
                          Play Store Lookup
                        </h4>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {storeLookupDone
                            ? "Ricerca già effettuata. Disabilita per permettere una nuova ricerca globale."
                            : "Ricerca non ancora effettuata o resettata."
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStoreLookupChange(!storeLookupDone)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors
                        ${storeLookupDone ? 'bg-blue-500' : 'bg-surface-300 dark:bg-white/20'}
                      `}
                    >
                      <div
                        className={`
                          absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                          ${storeLookupDone ? 'translate-x-7' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Labels */}
            {activeTab === 'labels' && (
              <div className="p-6 space-y-6">
                {/* Current Labels */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                    {t('admin.labels')}
                  </label>
                  <div className="flex flex-wrap gap-2 min-h-[40px]">
                    {labels.length === 0 ? (
                      <p className="text-sm text-surface-400 italic">
                        {t('admin.labelsDesc')}
                      </p>
                    ) : (
                      labels.map((label) => {
                        const colors = getLabelColor(label)
                        return (
                          <div
                            key={label}
                            className={`
                              flex items-center gap-1.5 px-3 py-1.5 rounded-lg border
                              ${colors.bg} ${colors.text} ${colors.border}
                            `}
                          >
                            <span className="text-sm font-medium">
                              {getLabelTranslation(label)}
                            </span>
                            <button
                              onClick={() => handleRemoveLabel(label)}
                              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                              <X className="w-3 h-3" strokeWidth={2} />
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Add Custom Label */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    {t('admin.addLabel')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLabelInput}
                      onChange={(e) => setNewLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newLabelInput.trim()) {
                          handleAddLabel(newLabelInput)
                        }
                      }}
                      placeholder={t('admin.labelPlaceholder')}
                      className="flex-1 px-4 py-2 rounded-lg border border-surface-200 dark:border-white/10
                        bg-surface-50 dark:bg-white/5 text-surface-900 dark:text-white
                        placeholder:text-surface-400
                        focus:outline-none focus:ring-2 focus:ring-accent-500/50
                        transition-all"
                    />
                    <Button
                      onClick={() => handleAddLabel(newLabelInput)}
                      disabled={!newLabelInput.trim()}
                      icon={<Plus className="w-4 h-4" strokeWidth={1.5} />}
                    >
                      {t('admin.addLabel')}
                    </Button>
                  </div>
                </div>

                {/* Suggested Labels */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                    {t('admin.suggestedLabels')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_LABELS.filter(l => !labels.includes(l)).map((label) => {
                      const colors = getLabelColor(label)
                      return (
                        <button
                          key={label}
                          onClick={() => handleAddLabel(label)}
                          className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all
                            hover:scale-105 active:scale-95
                            ${colors.bg} ${colors.text} ${colors.border}
                          `}
                        >
                          <Plus className="w-3 h-3" strokeWidth={2} />
                          <span className="text-sm font-medium">
                            {getLabelTranslation(label)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Icon */}
            {activeTab === 'icon' && (
              <div className="p-6 space-y-6">
                {/* Current Icon */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                    {t('admin.currentIcon')}
                  </label>
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-xl bg-surface-100 dark:bg-white/10 flex items-center justify-center border border-surface-200 dark:border-white/10 overflow-hidden">
                      {iconBase64 ? (
                        <img src={iconBase64} alt="App icon" className="w-full h-full object-contain" />
                      ) : (
                        <Image className="w-10 h-10 text-surface-400" strokeWidth={1} />
                      )}
                    </div>
                    {iconBase64 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveIcon}
                        icon={<Trash2 className="w-4 h-4" strokeWidth={1.5} />}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        {t('admin.removeIcon')}
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-surface-500">
                    {t('admin.iconDesc')}
                  </p>
                </div>

                {/* Upload from file */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    {t('admin.iconFromFile')}
                  </label>
                  <div
                    onDragOver={handleIconDragOver}
                    onDragLeave={handleIconDragLeave}
                    onDrop={handleIconDrop}
                    onClick={() => iconFileInputRef.current?.click()}
                    className={`
                      relative rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer
                      p-6 flex flex-col items-center justify-center gap-2
                      ${isDragOverIcon
                        ? 'border-accent-500 bg-accent-500/10'
                        : 'border-surface-300 dark:border-white/20 hover:border-accent-500/50 hover:bg-surface-50 dark:hover:bg-white/5'
                      }
                    `}
                  >
                    <input
                      ref={iconFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleIconInputChange}
                    />
                    <Upload className="w-8 h-8 text-surface-400" strokeWidth={1.5} />
                    <p className="text-sm text-surface-500">
                      {isDragOverIcon ? t('admin.dropImageHere') : t('admin.clickOrDragImage')}
                    </p>
                    <p className="text-xs text-surface-400">
                      PNG, JPG, GIF, WebP, SVG — Max 500KB
                    </p>
                  </div>
                </div>

                {/* Load from URL */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    {t('admin.iconFromUrl')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={iconUrl}
                      onChange={(e) => setIconUrl(e.target.value)}
                      placeholder={t('admin.iconUrlPlaceholder')}
                      className="flex-1 px-4 py-2 rounded-lg border border-surface-200 dark:border-white/10
                        bg-surface-50 dark:bg-white/5 text-surface-900 dark:text-white
                        placeholder:text-surface-400
                        focus:outline-none focus:ring-2 focus:ring-accent-500/50
                        transition-all"
                    />
                    <Button
                      onClick={handleLoadIconFromUrl}
                      disabled={!iconUrl.trim()}
                      icon={<ExternalLink className="w-4 h-4" strokeWidth={1.5} />}
                    >
                      {t('admin.loadIcon')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-surface-200 dark:border-white/10 bg-surface-50 dark:bg-white/5 flex-shrink-0">
            <div className="text-xs text-surface-500">
              {t('admin.languagesFilled')}: {SUPPORTED_LANGUAGES.filter(l => descriptions[l]?.trim()).length} / {SUPPORTED_LANGUAGES.length}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={onClose}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSave}
                loading={isSaving}
                disabled={!hasChanges}
                icon={<Save className="w-4 h-4" strokeWidth={1.5} />}
              >
                {t('admin.saveChanges')}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
