import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAdbStore } from '@/stores/adbStore'

interface AppAccessGuardProps {
  children: ReactNode
}

export function AppAccessGuard({ children }: AppAccessGuardProps) {
  const isConnected = useAdbStore((state) => state.isConnected)
  const isDemoMode = useAdbStore((state) => state.isDemoMode)

  if (!isConnected && !isDemoMode) {
    return <Navigate to="/?connect_required=1" replace />
  }

  return <>{children}</>
}
