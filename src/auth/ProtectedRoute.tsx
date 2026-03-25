import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { UserRole } from '../types'

interface Props {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

const POS_ROLES: UserRole[] = ['CASHIER', 'COOK', 'SUPERVISOR']

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user } = useAuth()
  const token = localStorage.getItem('token')

  if (!user || !token) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const defaultPath = POS_ROLES.includes(user.role) ? '/pos' : '/dashboard'
    return <Navigate to={defaultPath} replace />
  }

  return <>{children}</>
}