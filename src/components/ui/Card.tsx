/**
 * Card Component
 * Glassmorphism e ombre stratificate
 */

import { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

interface CardProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  variant?: 'default' | 'glass' | 'elevated'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

const variants = {
  default: 'bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/10',
  glass: 'bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-surface-200/50 dark:border-white/10',
  elevated: 'bg-white dark:bg-surface-900 shadow-elevated dark:shadow-glass',
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  hoverable = false,
  className = '',
  ...props
}: CardProps) {
  return (
    <motion.div
      whileHover={hoverable ? { y: -2, scale: 1.01 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        rounded-2xl
        ${variants[variant]}
        ${paddings[padding]}
        ${hoverable ? 'cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-surface-900 dark:text-white tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

