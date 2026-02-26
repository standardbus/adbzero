/**
 * Input Component
 * Con stili coerenti e feedback visivo
 */

import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'
import { Search } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, suffix, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full px-4 py-2.5 
              bg-surface-100 dark:bg-white/5
              border border-surface-200 dark:border-white/10
              rounded-xl
              text-surface-900 dark:text-white
              placeholder:text-surface-400 dark:placeholder:text-surface-600
              focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent
              transition-all duration-200
              ${icon ? 'pl-10' : ''}
              ${suffix ? 'pr-12' : ''}
              ${error ? 'border-red-500 focus:ring-red-500' : ''}
              ${className}
            `}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {suffix}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-500">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface SearchInputProps extends Omit<InputProps, 'icon'> {
  onClear?: () => void
}

export function SearchInput({ onClear, value, ...props }: SearchInputProps) {
  return (
    <Input
      icon={<Search className="w-4 h-4" strokeWidth={1.5} />}
      placeholder="Cerca..."
      value={value}
      suffix={
        value && onClear ? (
          <button
            onClick={onClear}
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : undefined
      }
      {...props}
    />
  )
}

