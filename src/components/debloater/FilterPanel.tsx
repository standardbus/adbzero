/**
 * Filter Panel
 * Pannello filtri avanzati per il Debloater
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Filter,
  X,
  ChevronDown,
  RotateCcw,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

import { useTranslation } from '@/stores/i18nStore'

export type RemovalLevel = 'Recommended' | 'Advanced' | 'Expert' | 'Unsafe'
export type PackageStatus = 'all' | 'enabled' | 'disabled'
export type PackageType = 'all' | 'system' | 'user'
export type PackageSource = 'all' | 'uad' | 'community' | 'unknown'

export interface FilterState {
  search: string
  status: PackageStatus
  type: PackageType
  categories: string[]
  manufacturers: string[]
  devices: string[]
  removalLevels: RemovalLevel[]
  source: PackageSource
}

export const defaultFilters: FilterState = {
  search: '',
  status: 'all',
  type: 'all',
  categories: [],
  manufacturers: [],
  devices: [],
  removalLevels: [],
  source: 'all'
}

interface FilterPanelProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  availableCategories: string[]
  availableManufacturers: string[]
  availableDevices: string[]
  onClose?: () => void
}

export function FilterPanel({
  filters,
  onChange,
  availableCategories,
  availableManufacturers,
  availableDevices,
  onClose
}: FilterPanelProps) {
  const { t } = useTranslation()
  const [expandedSections, setExpandedSections] = useState<string[]>(['status', 'level'])

  const REMOVAL_LEVELS: { value: RemovalLevel; label: string; color: string }[] = [
    { value: 'Recommended', label: t('filters.recommended'), color: 'bg-emerald-500' },
    { value: 'Advanced', label: t('filters.advanced'), color: 'bg-amber-500' },
    { value: 'Expert', label: t('filters.expert'), color: 'bg-orange-500' },
    { value: 'Unsafe', label: t('filters.unsafe'), color: 'bg-red-500' },
  ]

  const STATUS_OPTIONS: { value: PackageStatus; label: string }[] = [
    { value: 'all', label: t('filters.statusAll') },
    { value: 'enabled', label: t('filters.statusEnabled') },
    { value: 'disabled', label: t('filters.statusDisabled') },
  ]

  const TYPE_OPTIONS: { value: PackageType; label: string }[] = [
    { value: 'all', label: t('filters.typeAll') },
    { value: 'system', label: t('filters.typeSystem') },
    { value: 'user', label: t('filters.typeUser') },
  ]

  const SOURCE_OPTIONS: { value: PackageSource; label: string }[] = [
    { value: 'all', label: t('filters.sourceAll') },
    { value: 'uad', label: t('filters.sourceUad') },
    { value: 'community', label: t('filters.sourceCommunity') || 'Community' },
    { value: 'unknown', label: t('filters.sourceUnknown') },
  ]

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const handleReset = () => {
    onChange(defaultFilters)
  }

  const activeFiltersCount =
    (filters.status !== 'all' ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.source !== 'all' ? 1 : 0) +
    filters.categories.length +
    filters.manufacturers.length +
    filters.devices.length +
    filters.removalLevels.length

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 h-full bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-white/10 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-surface-200 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-accent-500" strokeWidth={1.5} />
          <span className="font-medium text-surface-900 dark:text-white">{t('common.filters')}</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-accent-500/10 text-accent-500 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={handleReset}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/5 transition-colors"
              title={t('debloater.removeFilters')}
            >
              <RotateCcw className="w-4 h-4 text-surface-500" strokeWidth={1.5} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4 text-surface-500" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Filter */}
        <FilterSection
          title={t('filters.status')}
          expanded={expandedSections.includes('status')}
          onToggle={() => toggleSection('status')}
        >
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => onChange({ ...filters, status: option.value })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${filters.status === option.value
                    ? 'bg-accent-500 text-white'
                    : 'bg-surface-100 dark:bg-white/5 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-white/10'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Type Filter */}
        <FilterSection
          title={t('filters.type')}
          expanded={expandedSections.includes('type')}
          onToggle={() => toggleSection('type')}
        >
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => onChange({ ...filters, type: option.value })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${filters.type === option.value
                    ? 'bg-accent-500 text-white'
                    : 'bg-surface-100 dark:bg-white/5 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-white/10'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Removal Level Filter */}
        <FilterSection
          title={t('filters.removalLevel')}
          expanded={expandedSections.includes('level')}
          onToggle={() => toggleSection('level')}
        >
          <div className="space-y-2">
            {REMOVAL_LEVELS.map(level => (
              <label
                key={level.value}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className={`
                  w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                  ${filters.removalLevels.includes(level.value)
                    ? 'bg-accent-500 border-accent-500'
                    : 'border-surface-300 dark:border-surface-600 group-hover:border-accent-400'
                  }
                `}>
                  {filters.removalLevels.includes(level.value) && (
                    <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${level.color}`} />
                  <span className="text-sm text-surface-700 dark:text-surface-300">
                    {level.label}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={filters.removalLevels.includes(level.value)}
                  onChange={(e) => {
                    const newLevels = e.target.checked
                      ? [...filters.removalLevels, level.value]
                      : filters.removalLevels.filter(l => l !== level.value)
                    onChange({ ...filters, removalLevels: newLevels })
                  }}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Source Filter */}
        <FilterSection
          title={t('filters.source')}
          expanded={expandedSections.includes('source')}
          onToggle={() => toggleSection('source')}
        >
          <div className="flex flex-wrap gap-2">
            {SOURCE_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => onChange({ ...filters, source: option.value })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${filters.source === option.value
                    ? 'bg-accent-500 text-white'
                    : 'bg-surface-100 dark:bg-white/5 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-white/10'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Categories */}
        {availableCategories.length > 0 && (
          <FilterSection
            title={t('filters.category')}
            expanded={expandedSections.includes('categories')}
            onToggle={() => toggleSection('categories')}
            badge={filters.categories.length > 0 ? filters.categories.length : undefined}
          >
            <div className="max-h-48 overflow-y-auto space-y-2">
              {availableCategories.map(category => (
                <label
                  key={category}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className={`
                    w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                    ${filters.categories.includes(category)
                      ? 'bg-accent-500 border-accent-500'
                      : 'border-surface-300 dark:border-surface-600 group-hover:border-accent-400'
                    }
                  `}>
                    {filters.categories.includes(category) && (
                      <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                    )}
                  </div>
                  <span className="text-sm text-surface-700 dark:text-surface-300 capitalize">
                    {category}
                  </span>
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category)}
                    onChange={(e) => {
                      const newCategories = e.target.checked
                        ? [...filters.categories, category]
                        : filters.categories.filter(c => c !== category)
                      onChange({ ...filters, categories: newCategories })
                    }}
                    className="sr-only"
                  />
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Manufacturers */}
        {availableManufacturers.length > 0 && (
          <FilterSection
            title={t('filters.manufacturer')}
            expanded={expandedSections.includes('manufacturers')}
            onToggle={() => toggleSection('manufacturers')}
            badge={filters.manufacturers.length > 0 ? filters.manufacturers.length : undefined}
          >
            <div className="max-h-48 overflow-y-auto space-y-2">
              {availableManufacturers.map(manufacturer => (
                <label
                  key={manufacturer}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className={`
                    w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                    ${filters.manufacturers.includes(manufacturer)
                      ? 'bg-accent-500 border-accent-500'
                      : 'border-surface-300 dark:border-surface-600 group-hover:border-accent-400'
                    }
                  `}>
                    {filters.manufacturers.includes(manufacturer) && (
                      <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                    )}
                  </div>
                  <span className="text-sm text-surface-700 dark:text-surface-300 capitalize">
                    {manufacturer}
                  </span>
                  <input
                    type="checkbox"
                    checked={filters.manufacturers.includes(manufacturer)}
                    onChange={(e) => {
                      const newManufacturers = e.target.checked
                        ? [...filters.manufacturers, manufacturer]
                        : filters.manufacturers.filter(m => m !== manufacturer)
                      onChange({ ...filters, manufacturers: newManufacturers })
                    }}
                    className="sr-only"
                  />
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Devices */}
        {availableDevices.length > 0 && (
          <FilterSection
            title={t('history.device')}
            expanded={expandedSections.includes('devices')}
            onToggle={() => toggleSection('devices')}
            badge={filters.devices.length > 0 ? filters.devices.length : undefined}
          >
            <div className="max-h-48 overflow-y-auto space-y-2">
              {availableDevices.map(device => (
                <label
                  key={device}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className={`
                    w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                    ${filters.devices.includes(device)
                      ? 'bg-accent-500 border-accent-500'
                      : 'border-surface-300 dark:border-surface-600 group-hover:border-accent-400'
                    }
                  `}>
                    {filters.devices.includes(device) && (
                      <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                    )}
                  </div>
                  <span className="text-sm text-surface-700 dark:text-surface-300">
                    {device}
                  </span>
                  <input
                    type="checkbox"
                    checked={filters.devices.includes(device)}
                    onChange={(e) => {
                      const newDevices = e.target.checked
                        ? [...filters.devices, device]
                        : filters.devices.filter(d => d !== device)
                      onChange({ ...filters, devices: newDevices })
                    }}
                    className="sr-only"
                  />
                </label>
              ))}
            </div>
          </FilterSection>
        )}
      </div>

      {/* Footer */}
      {activeFiltersCount > 0 && (
        <div className="p-4 border-t border-surface-200 dark:border-white/10">
          <Button
            variant="secondary"
            onClick={handleReset}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
            {t('debloater.removeFilters')}
          </Button>
        </div>
      )}
    </motion.div>
  )
}

interface FilterSectionProps {
  title: string
  expanded: boolean
  onToggle: () => void
  badge?: number
  children: React.ReactNode
}

function FilterSection({ title, expanded, onToggle, badge, children }: FilterSectionProps) {
  return (
    <div className="border border-surface-200 dark:border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-surface-900 dark:text-white">{title}</span>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-accent-500/10 text-accent-500 rounded-md">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-surface-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Active Filter Chips
 * Mostra i filtri attivi come chip cliccabili
 */
interface ActiveFiltersChipsProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

export function ActiveFiltersChips({ filters, onChange }: ActiveFiltersChipsProps) {
  const { t } = useTranslation()
  const chips: { label: string; onRemove: () => void }[] = []

  if (filters.status !== 'all') {
    chips.push({
      label: `${t('filters.status')}: ${filters.status === 'enabled' ? t('filters.statusEnabled') : t('filters.statusDisabled')}`,
      onRemove: () => onChange({ ...filters, status: 'all' })
    })
  }

  if (filters.type !== 'all') {
    chips.push({
      label: `${t('filters.type')}: ${filters.type === 'system' ? t('filters.typeSystem') : t('filters.typeUser')}`,
      onRemove: () => onChange({ ...filters, type: 'all' })
    })
  }

  if (filters.source !== 'all') {
    const sourceLabels = {
      uad: t('filters.sourceUad'),
      community: t('filters.sourceCommunity') || 'Community',
      unknown: t('filters.sourceUnknown')
    }
    chips.push({
      label: `${t('filters.source')}: ${sourceLabels[filters.source as keyof typeof sourceLabels]}`,
      onRemove: () => onChange({ ...filters, source: 'all' })
    })
  }

  filters.removalLevels.forEach(level => {
    const levelLabels: Record<string, string> = {
      Recommended: t('filters.recommended'),
      Advanced: t('filters.advanced'),
      Expert: t('filters.expert'),
      Unsafe: t('filters.unsafe')
    }
    chips.push({
      label: `${t('filters.removalLevel')}: ${levelLabels[level] || level}`,
      onRemove: () => onChange({
        ...filters,
        removalLevels: filters.removalLevels.filter(l => l !== level)
      })
    })
  })

  filters.categories.forEach(category => {
    chips.push({
      label: category,
      onRemove: () => onChange({
        ...filters,
        categories: filters.categories.filter(c => c !== category)
      })
    })
  })

  filters.manufacturers.forEach(manufacturer => {
    chips.push({
      label: `${manufacturer}`,
      onRemove: () => onChange({
        ...filters,
        manufacturers: filters.manufacturers.filter(m => m !== manufacturer)
      })
    })
  })

  filters.devices.forEach(device => {
    chips.push({
      label: device,
      onRemove: () => onChange({
        ...filters,
        devices: filters.devices.filter(d => d !== device)
      })
    })
  })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip, index) => (
        <motion.button
          key={`${chip.label}-${index}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={chip.onRemove}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
            bg-accent-500/10 text-accent-600 dark:text-accent-400
            hover:bg-accent-500/20 transition-colors group"
        >
          <span>{chip.label}</span>
          <X className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" strokeWidth={2} />
        </motion.button>
      ))}
    </div>
  )
}

