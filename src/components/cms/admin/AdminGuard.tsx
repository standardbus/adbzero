import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from '@/stores/i18nStore'

interface AdminGuardProps {
  children: ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { isLoading, isAuthenticated, isAdmin } = useAuthStore()
  const location = useLocation()
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-surface-500">
        {t('common.loading')}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/app" replace state={{ from: location.pathname }} />
  }

  if (!isAdmin) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
