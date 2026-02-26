/**
 * Toggle Switch
 * Fluido con spring physics
 */

import { motion } from 'framer-motion'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { track: 'w-8 h-5', thumb: 'w-4 h-4', translate: 14 },
  md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 20 },
  lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 28 },
}

export function Switch({ 
  checked, 
  onChange, 
  disabled = false, 
  loading = false,
  size = 'md' 
}: SwitchProps) {
  const sizeConfig = sizes[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex items-center rounded-full
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 
        focus:ring-offset-surface-950
        ${sizeConfig.track}
        ${checked 
          ? 'bg-accent-600' 
          : 'bg-surface-300 dark:bg-surface-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <motion.span
        initial={false}
        animate={{ 
          x: checked ? sizeConfig.translate : 2,
          scale: loading ? 0.8 : 1
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30
        }}
        className={`
          inline-block rounded-full bg-white shadow-sm
          ${sizeConfig.thumb}
          ${loading ? 'animate-pulse' : ''}
        `}
      />
    </button>
  )
}

