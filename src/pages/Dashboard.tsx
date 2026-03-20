import { useQuery } from '@tanstack/react-query'
import { getInventory } from '../api/inventory'
import { getSales } from '../api/sales'
import { getCarts } from '../api/carts'
import { getPayrollDueToday } from '../api/payroll'
import { getCancellationRequests } from '../api/cancellations'
import { getShifts } from '../api/shifts'
import { AlertTriangle, TrendingUp, ShoppingBag, Warehouse, Bell, DollarSign, XCircle, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { data: inventory = [] } = useQuery({ queryKey: ['inventory'],     queryFn: getInventory })
  const { data: sales = [] }     = useQuery({ queryKey: ['sales'],          queryFn: () => getSales() })
  const { data: carts = [] }     = useQuery({ queryKey: ['carts'],          queryFn: getCarts })
  const { data: duePayroll = [] }     = useQuery({ queryKey: ['payroll-due'],    queryFn: getPayrollDueToday })
  const { data: pendingCancels = [] } = useQuery({ queryKey: ['cancellation-requests', 'PENDING'], queryFn: () => getCancellationRequests('PENDING') })
  const { data: pendingShifts = [] }  = useQuery({ queryKey: ['shifts', 'PENDING_APPROVAL'], queryFn: () => getShifts('PENDING_APPROVAL') })

  const todaySales = sales.filter((s) => {
    const d = new Date(s.soldAt)
    const now = new Date()
    return d.toDateString() === now.toDateString() && s.status === 'COMPLETED'
  })

  const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0)
  const lowStock = inventory.filter((i) => i.belowMinimum)

  const cartSales = carts.map((cart) => {
    const cartToday = todaySales.filter((s) => s.cartId === cart.id)
    const total = cartToday.reduce((sum, s) => sum + s.totalAmount, 0)
    return { ...cart, count: cartToday.length, total }
  })

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>

      {/* Alerta de nómina */}
      {duePayroll.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 font-semibold">
              <Bell size={18} /> Nómina programada para hoy
            </div>
            <Link to="/payroll" className="text-xs text-amber-600 hover:text-amber-800 font-medium underline">
              Ir a Nómina →
            </Link>
          </div>
          <ul className="mt-2 space-y-1">
            {duePayroll.map((emp) => (
              <li key={emp.employeeId} className="flex items-center justify-between text-sm text-amber-700">
                <span className="flex items-center gap-1">
                  <DollarSign size={13} />
                  <span>{emp.employeeName}</span>
                  {emp.prorated && (
                    <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                      Prorateado
                    </span>
                  )}
                </span>
                <span className="font-semibold">
                  {emp.amountDue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alerta de cierres de turno pendientes */}
      {pendingShifts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700 font-semibold">
              <Clock size={18} /> Cierres de turno pendientes de aprobación
            </div>
            <Link to="/shifts" className="text-xs text-blue-600 hover:text-blue-800 font-medium underline">
              Ver turnos →
            </Link>
          </div>
          <ul className="mt-2 space-y-1">
            {pendingShifts.map((s) => {
              const diff = s.difference ?? 0
              return (
                <li key={s.id} className="flex items-center justify-between text-sm text-blue-700">
                  <span><span className="font-medium">{s.sellerName}</span> · {s.cartName}</span>
                  <span className={`font-semibold ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-amber-600' : 'text-blue-700'}`}>
                    {diff === 0 ? 'Cuadra' : diff > 0 ? `+${s.difference?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} sobrante` : `${s.difference?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} faltante`}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Alerta de cancelaciones pendientes */}
      {pendingCancels.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 font-semibold">
              <XCircle size={18} /> Solicitudes de cancelación pendientes
            </div>
            <Link to="/cancellations" className="text-xs text-red-600 hover:text-red-800 font-medium underline">
              Ver solicitudes →
            </Link>
          </div>
          <ul className="mt-2 space-y-1">
            {pendingCancels.map((req) => (
              <li key={req.id} className="flex items-center justify-between text-sm text-red-600">
                <span>
                  <span className="font-medium">{req.requestedByName}</span>{' '}
                  · Venta #{req.saleId} ({req.cartName})
                </span>
                <span className="font-semibold">
                  {req.saleTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<TrendingUp className="text-green-500" size={20} />}
          label="Ventas hoy" value={`$${todayTotal.toFixed(2)}`} color="green" />
        <KpiCard icon={<ShoppingBag className="text-violet-500" size={20} />}
          label="Transacciones hoy" value={todaySales.length.toString()} color="violet" />
        <KpiCard icon={<ShoppingBag className="text-blue-500" size={20} />}
          label="Carritos activos" value={carts.length.toString()} color="blue" />
        <KpiCard icon={<AlertTriangle className="text-red-500" size={20} />}
          label="Stock bajo mínimo" value={lowStock.length.toString()} color="red" />
      </div>

      {/* Alerta stock */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-3">
            <AlertTriangle size={18} /> Insumos bajo mínimo
          </div>
          <ul className="space-y-1">
            {lowStock.map((item) => (
              <li key={item.id} className="text-sm text-red-600 flex justify-between">
                <span>{item.name}</span>
                <span>{item.currentStock} / {item.minimumStock} {item.unitType}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Por carrito */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Rendimiento por carrito — Hoy
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cartSales.map((cart) => (
            <div key={cart.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Warehouse size={16} className="text-slate-400" />
                <span className="font-semibold text-slate-700">{cart.name}</span>
              </div>
              {cart.location && <p className="text-xs text-slate-400 mb-2">{cart.location}</p>}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{cart.count} ventas</span>
                <span className="font-bold text-green-600">${cart.total.toFixed(2)}</span>
              </div>
            </div>
          ))}
          {carts.length === 0 && (
            <p className="text-slate-400 text-sm col-span-full">No hay carritos registrados aún.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string
  color: 'green' | 'violet' | 'blue' | 'red'
}) {
  const bg = { green: 'bg-green-50', violet: 'bg-violet-50', blue: 'bg-blue-50', red: 'bg-red-50' }
  return (
    <div className={`${bg[color]} rounded-xl p-4`}>
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}
