import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  LayoutDashboard, Package, Tag, Warehouse, BookOpen,
  ShoppingCart, Users, Receipt, LogOut, Menu, X, Store,
  PackagePlus, BarChart3, DollarSign, XCircle, Clock
} from 'lucide-react'

const adminLinks = [
  { to: '/dashboard',       label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/products',        label: 'Productos',    icon: Package },
  { to: '/categories',      label: 'Categorías',   icon: Tag },
  { to: '/inventory',       label: 'Inventario',   icon: Warehouse },
  { to: '/purchase-orders', label: 'Resurtidos',   icon: PackagePlus },
  { to: '/recipes',         label: 'Recetas',      icon: BookOpen },
  { to: '/carts',           label: 'Carritos',     icon: ShoppingCart },
  { to: '/users',           label: 'Empleados',    icon: Users },
  { to: '/payroll',         label: 'Nómina',       icon: DollarSign },
  { to: '/sales',           label: 'Ventas',       icon: Receipt },
  { to: '/shifts',          label: 'Turnos',        icon: Clock },
  { to: '/cancellations',   label: 'Cancelaciones', icon: XCircle },
  { to: '/reports',         label: 'Reportes',     icon: BarChart3 },
]

const managerLinks = [
  { to: '/dashboard',       label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/inventory',       label: 'Inventario',   icon: Warehouse },
  { to: '/purchase-orders', label: 'Resurtidos',   icon: PackagePlus },
  { to: '/payroll',         label: 'Nómina',       icon: DollarSign },
  { to: '/sales',           label: 'Ventas',       icon: Receipt },
  { to: '/reports',         label: 'Reportes',     icon: BarChart3 },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const links = isAdmin ? adminLinks : managerLinks

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {links.map(({ to, label, icon: Icon }) => {
        const active = location.pathname === to
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-violet-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-56 flex-col bg-slate-900 text-white">
        <div className="px-4 py-5 border-b border-slate-700 flex items-center gap-2">
          <Store size={22} className="text-violet-400" />
          <span className="font-semibold text-white truncate">ERP Fast Food</span>
        </div>
        <NavLinks />
        <div className="px-4 py-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 mb-2 truncate">{user?.role}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64 bg-slate-900 text-white">
            <div className="px-4 py-5 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store size={20} className="text-violet-400" />
                <span className="font-semibold">ERP Fast Food</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>
            <NavLinks />
            <div className="px-4 py-4 border-t border-slate-700">
              <div className="text-xs text-slate-400 mb-2">{user?.role}</div>
              <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-400">
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setOpen(true)} className="text-slate-600">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Store size={18} className="text-violet-600" />
            <span className="font-semibold text-slate-800 text-sm">ERP Fast Food</span>
          </div>
          <div className="w-6" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
