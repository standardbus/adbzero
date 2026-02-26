/**
 * Auth Store
 * Gestisce lo stato dell'autenticazione utente con Zustand
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Session } from '@supabase/supabase-js'
import {
  signIn,
  signUp,
  signOut,
  signInWithOAuth,
  getSession,
  onAuthStateChange,
  type Device,
  type UserAction,
  getUserDevices,
  getAllUserActions
} from '@/services/supabase'
import { isAdmin as checkIsAdmin } from '@/config/app'

interface AuthState {
  // Auth state
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean  // Admin flag

  // User data
  userDevices: Device[]
  userActions: UserAction[]

  // Modal state
  showAuthModal: boolean
  authModalMode: 'login' | 'signup' | 'reset'

  // Actions
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, nickname: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithGithub: () => Promise<void>
  logout: () => Promise<void>
  loadUserData: () => Promise<void>
  setShowAuthModal: (show: boolean, mode?: 'login' | 'signup' | 'reset') => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,
      isAdmin: false,
      userDevices: [],
      userActions: [],
      showAuthModal: false,
      authModalMode: 'login',

      /**
       * Inizializza l'auth state e sottoscrivi a cambiamenti
       */
      initialize: async () => {
        set({ isLoading: true })

        try {
          // Get current session
          const session = await getSession()
          const user = session?.user || null

          // Check if user is admin (by UID from env, or Supabase metadata)
          const userIsAdmin = user ? (
            checkIsAdmin(user.id) ||
            user.app_metadata?.role === 'admin'
          ) : false

          set({
            session,
            user,
            isAuthenticated: !!user,
            isAdmin: userIsAdmin,
            isLoading: false
          })

          // Load user data if authenticated
          if (user) {
            get().loadUserData()
          }

          // Subscribe to auth changes
          onAuthStateChange(async (event, session) => {
            const user = session?.user || null

            const userIsAdmin = user ? (
              checkIsAdmin(user.id) ||
              user.app_metadata?.role === 'admin'
            ) : false

            set({
              session,
              user,
              isAuthenticated: !!user,
              isAdmin: userIsAdmin
            })

            if (event === 'SIGNED_IN' && user) {
              get().loadUserData()
            } else if (event === 'SIGNED_OUT') {
              set({ userDevices: [], userActions: [] })
            }
          })
        } catch (error) {
          console.error('Auth initialization error:', error)
          set({ isLoading: false })
        }
      },

      /**
       * Login con email e password
       */
      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { session, user } = await signIn(email, password)
          set({
            session,
            user,
            isAuthenticated: true,
            isLoading: false,
            showAuthModal: false
          })
          get().loadUserData()
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      /**
       * Registrazione con email e password
       */
      signup: async (email, password, nickname) => {
        set({ isLoading: true })
        try {
          const { session, user } = await signUp(email, password, nickname)
          set({
            session,
            user,
            isAuthenticated: !!session,
            isLoading: false,
            showAuthModal: !session // Keep open if email confirmation required
          })
          if (user) {
            get().loadUserData()
          }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      /**
       * Login con Google OAuth
       */
      loginWithGoogle: async () => {
        try {
          await signInWithOAuth('google')
        } catch (error) {
          console.error('Google login error:', error)
          throw error
        }
      },

      /**
       * Login con GitHub OAuth
       */
      loginWithGithub: async () => {
        try {
          await signInWithOAuth('github')
        } catch (error) {
          console.error('GitHub login error:', error)
          throw error
        }
      },

      /**
       * Logout
       */
      logout: async () => {
        try {
          await signOut()
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            userDevices: [],
            userActions: []
          })
        } catch (error) {
          console.error('Logout error:', error)
          throw error
        }
      },

      /**
       * Carica dati utente (dispositivi e azioni)
       */
      loadUserData: async () => {
        const { user } = get()
        if (!user) return

        try {
          const [devices, actions] = await Promise.all([
            getUserDevices(user.id),
            getAllUserActions(user.id)
          ])

          set({
            userDevices: devices,
            userActions: actions
          })
        } catch (error) {
          console.error('Error loading user data:', error)
        }
      },

      /**
       * Mostra/nascondi modal auth
       */
      setShowAuthModal: (show, mode = 'login') => {
        set({
          showAuthModal: show,
          authModalMode: mode
        })
      }
    }),
    {
      name: 'adbloater-auth-store',
      partialize: () => ({
        // Non persistiamo dati sensibili
      })
    }
  )
)

// Inizializza auth al caricamento dell'app
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize()
}

