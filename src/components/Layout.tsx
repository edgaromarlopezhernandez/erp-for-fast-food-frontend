import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  LayoutDashboard, Package, Tag, Warehouse, BookOpen,
  ShoppingCart, Users, Receipt, LogOut, Menu, X, Store,
  PackagePlus, BarChart3, DollarSign, XCircle, Clock,
  TrendingDown, ArrowLeftRight, Wallet, Building2, ShieldCheck, ChefHat,
} from 'lucide-react'

// Dueño del negocio — acceso completo
const ownerLinks = [
  { to: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/products',        label: 'Productos',      icon: Package },
  { to: '/categories',      label: 'Categorías de productos', icon: Tag },
  { to: '/inventory',       label: 'Bodega',         icon: Warehouse },
  { to: '/purchase-orders', label: 'Resurtidos',     icon: PackagePlus },
  { to: '/requisitions',    label: 'Requisiciones',  icon: ArrowLeftRight },
  { to: '/recipes',         label: 'Recetas',        icon: BookOpen },
  { to: '/productions',     label: 'Producción',     icon: ChefHat },
  { to: '/carts',           label: 'PDVs',            icon: ShoppingCart },
  { to: '/users',           label: 'Empleados',      icon: Users },
  { to: '/payroll',         label: 'Nómina',         icon: DollarSign },
  { to: '/sales',           label: 'Ventas',         icon: Receipt },
  { to: '/shifts',          label: 'Turnos',         icon: Clock },
  { to: '/cancellations',   label: 'Cancelaciones',  icon: XCircle },
  { to: '/expenses',        label: 'Gastos',         icon: TrendingDown },
  { to: '/cash-account',    label: 'Caja',           icon: Wallet },
  { to: '/reports',         label: 'Reportes',       icon: BarChart3 },
  { to: '/business',        label: 'Mi Negocio',     icon: Building2 },
]

// Admin empleado — sin reportes financieros ni datos del negocio
const adminEmployeeLinks = [
  { to: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/products',        label: 'Productos',      icon: Package },
  { to: '/categories',      label: 'Categorías de productos', icon: Tag },
  { to: '/inventory',       label: 'Bodega',         icon: Warehouse },
  { to: '/purchase-orders', label: 'Resurtidos',     icon: PackagePlus },
  { to: '/requisitions',    label: 'Requisiciones',  icon: ArrowLeftRight },
  { to: '/recipes',         label: 'Recetas',        icon: BookOpen },
  { to: '/productions',     label: 'Producción',     icon: ChefHat },
  { to: '/carts',           label: 'PDVs',            icon: ShoppingCart },
  { to: '/users',           label: 'Empleados',      icon: Users },
  { to: '/payroll',         label: 'Nómina',         icon: DollarSign },
  { to: '/sales',           label: 'Ventas',         icon: Receipt },
  { to: '/shifts',          label: 'Turnos',         icon: Clock },
  { to: '/cancellations',   label: 'Cancelaciones',  icon: XCircle },
  { to: '/expenses',        label: 'Gastos',         icon: TrendingDown },
  { to: '/cash-account',    label: 'Caja',           icon: Wallet },
]

// Gerente — operativo, sin financieros
const managerLinks = [
  { to: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/inventory',       label: 'Bodega',         icon: Warehouse },
  { to: '/purchase-orders', label: 'Resurtidos',     icon: PackagePlus },
  { to: '/requisitions',    label: 'Requisiciones',  icon: ArrowLeftRight },
  { to: '/payroll',         label: 'Nómina',         icon: DollarSign },
  { to: '/productions',     label: 'Producción',     icon: ChefHat },
  { to: '/sales',           label: 'Ventas',         icon: Receipt },
  { to: '/shifts',          label: 'Turnos',         icon: Clock },
  { to: '/cancellations',   label: 'Cancelaciones',  icon: XCircle },
  { to: '/cash-account',    label: 'Caja',           icon: Wallet },
]

// Supervisor de punto de venta
const supervisorLinks = [
  { to: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/sales',           label: 'Ventas',         icon: Receipt },
  { to: '/shifts',          label: 'Turnos',         icon: Clock },
  { to: '/cancellations',   label: 'Cancelaciones',  icon: XCircle },
]

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  ADMIN:      { label: 'Admin',      color: 'text-violet-400' },
  MANAGER:    { label: 'Gerente',    color: 'text-blue-400' },
  SUPERVISOR: { label: 'Supervisor', color: 'text-cyan-400' },
  CASHIER:    { label: 'Cajero',     color: 'text-green-400' },
  COOK:       { label: 'Cocinero',   color: 'text-orange-400' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isOwner, isSupervisor } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const links = (() => {
    if (user?.role === 'ADMIN')    return isOwner ? ownerLinks : adminEmployeeLinks
    if (user?.role === 'MANAGER')  return managerLinks
    if (user?.role === 'SUPERVISOR') return supervisorLinks
    return []
  })()

  const roleBadge = ROLE_BADGE[user?.role ?? '']

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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

  const SidebarFooter = () => (
    <div className="px-4 py-4 border-t border-slate-700">
      <div className="flex items-center gap-1.5 mb-2">
        {isOwner && <ShieldCheck size={12} className="text-amber-400" />}
        <span className={`text-xs font-medium ${roleBadge?.color ?? 'text-slate-400'}`}>
          {isOwner ? 'Propietario' : roleBadge?.label}
        </span>
      </div>
      <div className="text-xs text-slate-500 truncate mb-2">{user?.businessName}</div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <LogOut size={16} /> Cerrar sesión
      </button>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-56 flex-col bg-slate-900 text-white">
        <div className="px-4 py-5 border-b border-slate-700 flex items-center gap-2">
          <Store size={22} className="text-violet-400" />
          <span className="font-semibold text-white truncate">{user?.businessName?.toUpperCase() ?? 'ERP FAST FOOD'}</span>
        </div>
        <NavLinks />
        <SidebarFooter />
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64 bg-slate-900 text-white">
            <div className="px-4 py-5 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store size={20} className="text-violet-400" />
                <span className="font-semibold">{user?.businessName?.toUpperCase() ?? 'ERP FAST FOOD'}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>
            <NavLinks />
            <SidebarFooter />
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
            <span className="font-semibold text-slate-800 text-sm">{user?.businessName?.toUpperCase() ?? 'ERP FAST FOOD'}</span>
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