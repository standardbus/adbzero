/**
 * Toast Notifications
 * Minimalisti e animati con Framer Motion
 */

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors = {
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  info: 'bg-accent-500/10 border-accent-500/20 text-accent-600 dark:text-accent-400',
}

const iconColors = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-accent-500',
}

export function Toast() {
  const toasts = useAppStore((state) => state.toasts)
  const dismissToast = useAppStore((state) => state.dismissToast)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = icons[toast.type]
          
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className={`
                flex items-start gap-3 px-4 py-3 rounded-2xl
                backdrop-blur-xl border shadow-elevated
                max-w-sm min-w-[280px]
                ${colors[toast.type]}
              `}
            >
              <Icon 
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColors[toast.type]}`} 
                strokeWidth={1.5} 
              />
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-surface-900 dark:text-white">
                  {toast.title}
                </p>
                {toast.message && (
                  <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5 break-words">
                    {toast.message}
                  </p>
                )}
              </div>
              
              <button
                onClick={() => dismissToast(toast.id)}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-surface-900/10 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-surface-500" strokeWidth={1.5} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

