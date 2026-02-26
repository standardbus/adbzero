/**
 * Button Component
 * Con varianti e animazioni
 */

import { ReactNode, forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'

type MotionButtonProps = Omit<HTMLMotionProps<'button'>, 'children'>

interface ButtonProps extends MotionButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
}

const variants = {
  primary: `
    bg-accent-600 hover:bg-accent-700 active:bg-accent-800
    text-white font-medium
    shadow-lg shadow-accent-600/25 hover:shadow-xl hover:shadow-accent-600/30
    focus:ring-accent-500
  `,
  secondary: `
    bg-surface-100 dark:bg-white/10 hover:bg-surface-200 dark:hover:bg-white/15
    text-surface-900 dark:text-white font-medium
    border border-surface-200 dark:border-white/10
    focus:ring-surface-400
  `,
  ghost: `
    text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white
    hover:bg-surface-100 dark:hover:bg-white/5
    focus:ring-surface-400
  `,
  danger: `
    bg-red-500/10 hover:bg-red-500/20
    text-red-600 dark:text-red-400 font-medium
    focus:ring-red-500
  `,
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    iconPosition = 'left',
    className = '',
    onClick,
    ...props
  }, ref) {
    const isDisabled = disabled || loading

    return (
      <motion.button
        ref={ref}
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
        disabled={isDisabled}
        onClick={onClick}
        className={`
          inline-flex items-center justify-center
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-950
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
        )}
        {!loading && icon && iconPosition === 'left' && icon}
        {children}
        {!loading && icon && iconPosition === 'right' && icon}
      </motion.button>
    )
  }
)
