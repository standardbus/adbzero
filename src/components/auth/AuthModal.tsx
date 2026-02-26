/**
 * Auth Modal
 * Login/Signup con email o OAuth
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Mail,
  Lock,
  User,
  Github,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { resetPassword, checkNicknameAvailable } from '@/services/supabase'
import { useTranslation } from '@/stores/i18nStore'

export function AuthModal() {
  const {
    showAuthModal,
    authModalMode,
    isLoading,
    login,
    signup,
    loginWithGoogle,
    loginWithGithub,
    setShowAuthModal
  } = useAuthStore()
  const { t } = useTranslation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [isNicknameAvailable, setIsNicknameAvailable] = useState<boolean | null>(null)
  const [isCheckingNickname, setIsCheckingNickname] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Reset stati quando il modal si chiude o cambia modalità
  useEffect(() => {
    if (!showAuthModal) {
      setNickname('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setError(null)
      setSuccess(null)
      setIsNicknameAvailable(null)
    }
  }, [showAuthModal, authModalMode])

  // Controllo disponibilità nickname debounced
  useEffect(() => {
    if (authModalMode !== 'signup' || nickname.length < 3) {
      setIsNicknameAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsCheckingNickname(true)
      const isAvailable = await checkNicknameAvailable(nickname)
      setIsNicknameAvailable(isAvailable)
      setIsCheckingNickname(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [nickname, authModalMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      if (authModalMode === 'login') {
        await login(email, password)
      } else if (authModalMode === 'signup') {
        if (!nickname || nickname.length < 3) {
          setError(t('auth.nicknameTooShort'))
          return
        }
        if (isNicknameAvailable === false) {
          setError(t('auth.nicknameTaken'))
          return
        }
        if (password !== confirmPassword) {
          setError(t('auth.passwordsDontMatch'))
          return
        }
        if (password.length < 6) {
          setError(t('auth.passwordTooShort'))
          return
        }
        await signup(email, password, nickname)
        setSuccess(t('auth.checkEmailSignup'))
      } else if (authModalMode === 'reset') {
        await resetPassword(email)
        setSuccess(t('auth.resetEmailSent'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errorOccurred'))
    }
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError(null)
    try {
      if (provider === 'google') {
        await loginWithGoogle()
      } else {
        await loginWithGithub()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.oauthError'))
    }
  }

  if (!showAuthModal) return null

  const titles = {
    login: t('auth.loginTitle'),
    signup: t('auth.registerTitle'),
    reset: t('auth.resetTitle')
  }

  const subtitles = {
    login: t('auth.loginSubtitle'),
    signup: t('auth.registerSubtitle'),
    reset: t('auth.resetSubtitle')
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowAuthModal(false)}
          className="absolute inset-0 bg-surface-950/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="relative w-full max-w-md bg-white dark:bg-surface-900 rounded-2xl shadow-elevated-lg border border-surface-200 dark:border-white/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-white/10">
            <div>
              <h2 className="text-xl font-semibold text-surface-900 dark:text-white tracking-tight">
                {titles[authModalMode]}
              </h2>
              <p className="text-sm text-surface-500 mt-0.5">
                {subtitles[authModalMode]}
              </p>
            </div>
            <button
              onClick={() => setShowAuthModal(false)}
              className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5 text-surface-500" strokeWidth={1.5} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Error/Success Messages */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* OAuth Buttons */}
            {authModalMode !== 'reset' && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <Button
                    variant="secondary"
                    onClick={() => handleOAuth('google')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <GoogleIcon />
                    Google
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleOAuth('github')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <Github className="w-4 h-4" strokeWidth={1.5} />
                    GitHub
                  </Button>
                </div>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-surface-200 dark:border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-white dark:bg-surface-900 text-surface-500">
                      {t('auth.orWithEmail')}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {authModalMode === 'signup' && (
                <div className="space-y-1">
                  <Input
                    type="text"
                    label={t('auth.nickname')}
                    placeholder={t('auth.nicknamePlaceholder')}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    icon={<User className="w-4 h-4" strokeWidth={1.5} />}
                    required
                    minLength={3}
                    maxLength={30}
                    className={
                      isNicknameAvailable === true ? 'border-emerald-500/50' :
                        isNicknameAvailable === false ? 'border-red-500/50' : ''
                    }
                  />
                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5 px-1 h-5">
                    {isCheckingNickname && (
                      <>
                        <Loader2 className="w-3 h-3 text-surface-400 animate-spin" />
                        <span className="text-[11px] text-surface-400">{t('auth.nicknameChecking')}</span>
                      </>
                    )}
                    {!isCheckingNickname && isNicknameAvailable === true && (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span className="text-[11px] text-emerald-500">{t('auth.nicknameAvailable')}</span>
                      </>
                    )}
                    {!isCheckingNickname && isNicknameAvailable === false && (
                      <>
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span className="text-[11px] text-red-500">{t('auth.nicknameTaken')}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <Input
                type="email"
                label={t('auth.email')}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" strokeWidth={1.5} />}
                required
              />

              {authModalMode !== 'reset' && (
                <Input
                  type="password"
                  label={t('auth.password')}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" strokeWidth={1.5} />}
                  required
                  minLength={6}
                />
              )}

              {authModalMode === 'signup' && (
                <Input
                  type="password"
                  label={t('auth.confirmPassword')}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" strokeWidth={1.5} />}
                  required
                />
              )}

              <Button
                type="submit"
                className="w-full"
                loading={isLoading}
                disabled={isLoading}
              >
                {authModalMode === 'login' && t('auth.signIn')}
                {authModalMode === 'signup' && t('auth.signUp')}
                {authModalMode === 'reset' && t('auth.sendResetEmail')}
              </Button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center space-y-2">
              {authModalMode === 'login' && (
                <>
                  <button
                    onClick={() => setShowAuthModal(true, 'reset')}
                    className="text-sm text-accent-500 hover:text-accent-400 transition-colors"
                  >
                    {t('auth.forgotPassword')}
                  </button>
                  <p className="text-sm text-surface-500">
                    {t('auth.noAccount')}{' '}
                    <button
                      onClick={() => setShowAuthModal(true, 'signup')}
                      className="text-accent-500 hover:text-accent-400 font-medium transition-colors"
                    >
                      {t('auth.register')}
                    </button>
                  </p>
                </>
              )}
              {authModalMode === 'signup' && (
                <p className="text-sm text-surface-500">
                  {t('auth.haveAccount')}{' '}
                  <button
                    onClick={() => setShowAuthModal(true, 'login')}
                    className="text-accent-500 hover:text-accent-400 font-medium transition-colors"
                  >
                    {t('auth.login')}
                  </button>
                </p>
              )}
              {authModalMode === 'reset' && (
                <button
                  onClick={() => setShowAuthModal(true, 'login')}
                  className="text-sm text-accent-500 hover:text-accent-400 transition-colors"
                >
                  {t('auth.backToLogin')}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
