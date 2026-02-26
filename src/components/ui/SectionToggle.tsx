/**
 * SectionToggle Component
 * Collapsible section with animated toggle
 */

import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, LucideIcon } from 'lucide-react'

interface SectionToggleProps {
    id: string
    title: string
    icon: LucideIcon
    isExpanded: boolean
    onToggle: () => void
    children: ReactNode
}

export function SectionToggle({
    title,
    icon: Icon,
    isExpanded,
    onToggle,
    children
}: SectionToggleProps) {
    return (
        <div className="glass-card overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
            >
                <div className="p-3 rounded-xl bg-accent-500/10">
                    <Icon className="w-6 h-6 text-accent-500" strokeWidth={1.5} />
                </div>
                <div className="flex-1 text-left">
                    <h3 className="font-semibold text-surface-900 dark:text-white">
                        {title}
                    </h3>
                </div>
                <ChevronDown
                    className={`w-5 h-5 text-surface-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    strokeWidth={1.5}
                />
            </button>
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 border-t border-white/5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
