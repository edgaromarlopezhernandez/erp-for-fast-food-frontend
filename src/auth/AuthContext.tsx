import { createContext, useContext, useState, type ReactNode } from 'react'
import type { LoginResponse, UserRole } from '../types'

interface AuthUser {
  token: string
  role: UserRole
  tenantId: number
  businessName: string | null
  owner: boolean
}

interface AuthContextType {
  user: AuthUser | null
  login: (data: LoginResponse) => void
  logout: () => void
  isAdmin: boolean
  isOwner: boolean
  isManager: boolean
  isSupervisor: boolean
  isCashier: boolean
  isCook: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = (data: LoginResponse) => {
    const authUser: AuthUser = {
      token: data.token,
      role: data.role,
      tenantId: data.tenantId,
      businessName: data.businessName ?? null,
      owner: data.owner ?? false,
    }
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(authUser))
    setUser(authUser)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAdmin:      user?.role === 'ADMIN',
      isOwner:      user?.role === 'ADMIN' && (user?.owner ?? false),
      isManager:    user?.role === 'MANAGER',
      isSupervisor: user?.role === 'SUPERVISOR',
      isCashier:    user?.role === 'CASHIER',
      isCook:       user?.role === 'COOK',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}