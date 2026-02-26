/**
 * Layout principale dell'applicazione
 * Mobile-first: sidebar nascosta su mobile con hamburger menu
 */

import { ReactNode, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface LayoutProps {
  children: ReactNode
  showSidebar?: boolean
  noScroll?: boolean
}

export function Layout({ children, showSidebar = false, noScroll = false }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isMobile = useIsMobile()

  return (
    <div className="min-h-screen flex">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {showSidebar && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <AnimatePresence mode="wait">
        {showSidebar && (
          <>
            {/* Desktop Sidebar */}
            <motion.aside
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 z-40"
            >
              <Sidebar onNavigate={() => { }} />
            </motion.aside>

            {/* Mobile Sidebar */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: mobileMenuOpen ? 0 : -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 z-50"
            >
              <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Header with Hamburger */}
      {showSidebar && (
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-200/50 dark:border-white/5 z-30 flex items-center px-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-white/5 transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-surface-700 dark:text-surface-300" />
            ) : (
              <Menu className="w-6 h-6 text-surface-700 dark:text-surface-300" />
            )}
          </button>
          <div className="ml-3 flex items-center gap-2">
            <img
              src="/adbzero_logo.webp"
              alt="ADBZero"
              className="w-8 h-8 rounded-lg object-cover border border-surface-200/70 dark:border-white/10 shadow-sm"
            />
            <span className="font-semibold text-surface-900 dark:text-white">ADBZero</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${noScroll ? 'h-screen overflow-hidden' : 'min-h-screen'
          } ${showSidebar ? 'lg:ml-64 pt-16 lg:pt-0' : 'ml-0'}`}
      >
        {/* Animated Background System - Only for Desktop */}
        <div className="fixed inset-0 -z-10 overflow-hidden bg-surface-50 dark:bg-surface-950">
          {!isMobile && (
            <>
              {/* Main animated blobs with color shifting */}
              <motion.div
                animate={{
                  x: [0, 150, -100, 0],
                  y: [0, -150, 100, 0],
                  scale: [1, 1.4, 0.9, 1],
                  backgroundColor: [
                    'rgba(59, 130, 246, 0.15)', // Blue
                    'rgba(168, 85, 247, 0.15)', // Purple
                    'rgba(236, 72, 153, 0.15)', // Pink
                    'rgba(59, 130, 246, 0.15)'
                  ],
                }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="absolute -top-[15%] -left-[15%] w-[60%] h-[60%] rounded-full blur-[120px]"
              />

              <motion.div
                animate={{
                  x: [0, -200, 150, 0],
                  y: [0, 200, -100, 0],
                  scale: [1, 0.7, 1.4, 1],
                  backgroundColor: [
                    'rgba(139, 92, 246, 0.15)', // Violet
                    'rgba(6, 182, 212, 0.15)',  // Cyan
                    'rgba(244, 63, 94, 0.15)',  // Rose
                    'rgba(139, 92, 246, 0.15)'
                  ],
                }}
                transition={{
                  duration: 15,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="absolute -bottom-[15%] -right-[15%] w-[70%] h-[70%] rounded-full blur-[150px]"
              />

              <motion.div
                animate={{
                  x: [0, 120, -150, 0],
                  y: [0, 100, 180, 0],
                  backgroundColor: [
                    'rgba(6, 182, 212, 0.1)', // Cyan
                    'rgba(59, 130, 246, 0.1)', // Blue
                    'rgba(16, 185, 129, 0.1)', // Emerald
                    'rgba(6, 182, 212, 0.1)'
                  ],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute top-[20%] left-[30%] w-[50%] h-[50%] rounded-full blur-[100px]"
              />
            </>
          )}

          {/* Simple static glow for mobile to keep the vibe without the cost */}
          {isMobile && (
            <>
              <div className="absolute top-0 left-0 w-full h-full bg-accent-500/5 blur-3xl opacity-50" />
              <div className="absolute bottom-0 right-0 w-3/4 h-3/4 bg-purple-500/5 blur-3xl opacity-30" />
            </>
          )}

          {/* Noise/Grain Texture for premium feel */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        </div>

        <div className={`relative ${noScroll ? 'h-full' : 'min-h-screen'}`}>
          {children}
        </div>
      </main>
    </div>
  )
}

