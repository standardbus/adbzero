/**
 * App Store
 * Gestisce lo stato generale dell'applicazione
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Page = 'connect' | 'dashboard' | 'debloater' | 'debloat-lists' | 'degoogle' | 'privacy' | 'root-tools' | 'history' | 'settings' | 'setup' | 'device-tools' | 'screen-mirror' | 'desktop' | 'shizuku' | 'admin-analytics' | 'apk-installer' | 'app-cloner'
export type Theme = 'light' | 'dark'

interface ToastData {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

interface AppState {
  // Navigation
  currentPage: Page

  // Theme
  theme: Theme

  // Premium
  isPremium: boolean

  // Onboarding
  hasCompletedOnboarding: boolean

  // Toasts
  toasts: ToastData[]

  // Actions
  setCurrentPage: (page: Page) => void
  setTheme: (theme: Theme) => void
  setPremium: (isPremium: boolean) => void
  setOnboardingCompleted: (completed: boolean) => void
  showToast: (toast: Omit<ToastData, 'id'>) => void
  dismissToast: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentPage: 'connect',
      theme: 'dark',
      isPremium: false,
      hasCompletedOnboarding: false,
      toasts: [],

      setCurrentPage: (page) => set({ currentPage: page }),

      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },

      setPremium: (isPremium) => set({ isPremium }),

      setOnboardingCompleted: (completed) => set({ hasCompletedOnboarding: completed }),

      showToast: (toast) => {
        const id = crypto.randomUUID()
        const newToast = { ...toast, id }

        set((state) => ({
          toasts: [...state.toasts, newToast]
        }))

        // Auto dismiss
        const duration = toast.duration ?? 4000
        if (duration > 0) {
          setTimeout(() => {
            get().dismissToast(id)
          }, duration)
        }
      },

      dismissToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      }))
    }),
    {
      name: 'adbloater-app-store',
      partialize: (state) => ({
        theme: state.theme,
        isPremium: state.isPremium,
        hasCompletedOnboarding: state.hasCompletedOnboarding
      })
    }
  )
)

// Helper function to apply theme
function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return

  const root = document.documentElement
  const isDark = theme === 'dark'

  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// Initialize theme and listeners on load
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('adbloater-app-store')
  let currentTheme: Theme = 'dark'
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      if (state?.theme) currentTheme = state.theme
    } catch {
      // Ignore
    }
  }
  applyTheme(currentTheme)
}

