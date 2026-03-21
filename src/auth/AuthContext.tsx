import { createContext, useContext, useState, type ReactNode } from 'react'
import type { LoginResponse, UserRole } from '../types'

interface AuthUser {
  token: string
  role: UserRole
  tenantId: number
  businessName: string | null
}

interface AuthContextType {
  user: AuthUser | null
  login: (data: LoginResponse) => void
  logout: () => void
  isAdmin: boolean
  isManager: boolean
  isCashier: boolean
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
      isAdmin: user?.role === 'ADMIN',
      isManager: user?.role === 'MANAGER',
      isCashier: user?.role === 'CASHIER',
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
