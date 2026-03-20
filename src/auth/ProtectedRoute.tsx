import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { UserRole } from '../types'

interface Props {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'CASHIER' ? '/pos' : '/dashboard'} replace />
  }

  return <>{children}</>
}
