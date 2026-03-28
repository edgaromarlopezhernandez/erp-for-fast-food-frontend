import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DailySummary } from '../types'
import { getInventory, getCartStockAnalysis } from '../api/inventory'
import { getSales } from '../api/sales'
import { getCarts } from '../api/carts'
import { getPayrollDueToday } from '../api/payroll'
import { getCancellationRequests } from '../api/cancellations'
import { getShifts } from '../api/shifts'
import { getRequisitions } from '../api/requisitions'
import { getPurchaseOrders } from '../api/purchaseOrders'
import { getGeneralRegister } from '../api/cashAccount'
import { getDailySummary } from '../api/reports'
import {
  AlertTriangle, TrendingUp, ShoppingBag, Warehouse,
  Bell, DollarSign, XCircle, Clock, LayoutGrid, Truck, BanknoteIcon, PlayCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [selectedCartId, setSelectedCartId] = useState<number | undefined>(undefined)
  const isCartView = selectedCartId !== undefined

  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const activeCarts = carts.filter((c) => c.active)
  const selectedCart = activeCarts.find((c) => c.id === selectedCartId)

  const { data: sales = [] } = useQuery({
    queryKey: ['sales', selectedCartId],
    queryFn: () => getSales(selectedCartId),
  })

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', selectedCartId],
    queryFn: () => getInventory(selectedCartId),
  })

  const { data: analysis } = useQuery({
    queryKey: ['cart-analysis', selectedCartId, 30],
    queryFn: () => getCartStockAnalysis(selectedCartId!, 30),
    enabled: isCartView,
  })

  const { data: dailySummary } = useQuery({
    queryKey: ['today-summary', selectedCartId],
    queryFn: () => getDailySummary(selectedCartId),
    refetchInterval: 60_000,
  })

  // Global alerts — always shown regardless of filter
  const { data: duePayroll = [] }         = useQuery({ queryKey: ['payroll-due'],    queryFn: getPayrollDueToday })
  const { data: pendingCancels = [] }     = useQuery({ queryKey: ['cancellation-requests', 'PENDING'], queryFn: () => getCancellationRequests('PENDING') })
  const { data: pendingShifts = [] }      = useQuery({ queryKey: ['shifts', 'PENDING_APPROVAL'], queryFn: () => getShifts('PENDING_APPROVAL') })
  const { data: openShifts = [] }         = useQuery({ queryKey: ['shifts', 'OPEN'], queryFn: () => getShifts('OPEN'), refetchInterval: 60_000 })
  const { data: pendingReqs = [] }        = useQuery({ queryKey: ['requisitions', 'SOLICITADA'],       queryFn: () => getRequisitions({ status: 'SOLICITADA' }),       refetchInterval: 60_000 })
  const { data: approvedReqs = [] }       = useQuery({ queryKey: ['requisitions', 'APROBADA'],         queryFn: () => getRequisitions({ status: 'APROBADA' }),         refetchInterval: 60_000 })
  const { data: discrepancyReqs = [] }    = useQuery({ queryKey: ['requisitions', 'CON_DISCREPANCIA'], queryFn: () => getRequisitions({ status: 'CON_DISCREPANCIA' }), refetchInterval: 60_000 })
  const { data: draftOrders = [] }        = useQuery({ queryKey: ['purchase-orders'],                  queryFn: getPurchaseOrders,                                     refetchInterval: 60_000 })
  const { data: generalRegister }         = useQuery({ queryKey: ['general-register'],                 queryFn: getGeneralRegister,                                    refetchInterval: 60_000 })

  // Carritos activos sin turno abierto
  const openShiftCartIds = new Set(openShifts.map((s) => s.cartId))
  const cartsWithoutShift = activeCarts.filter((c) => !openShiftCartIds.has(c.id))

  // Alerta de fondos insuficientes para resurtidos pendientes
  const pendingDraftOrders = draftOrders.filter(o => o.status === 'DRAFT')
  const totalDraftCost = pendingDraftOrders.reduce((sum, o) => sum + o.totalAmount, 0)
  const cashBalance = generalRegister?.balance ?? 0
  const insufficientFunds = pendingDraftOrders.length > 0 && totalDraftCost > cashBalance
  const fundingShortfall = totalDraftCost - cashBalance

  const todaySales = sales.filter((s) => {
    const d = new Date(s.soldAt)
    return d.toDateString() === new Date().toDateString() && s.status === 'COMPLETED'
  })
  const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0)

  // General view
  const lowStock = inventory.filter((i) => i.belowMinimum)

  // Cart view — from analysis
  const criticalItems = analysis?.items.filter((i) => i.status === 'CRITICAL') ?? []
  const lowItems      = analysis?.items.filter((i) => i.status === 'LOW') ?? []

  // Per-cart breakdown (only for general view)
  const cartSales = activeCarts.map((cart) => {
    const cartToday = todaySales.filter((s) => s.cartId === cart.id)
    return { ...cart, count: cartToday.length, total: cartToday.reduce((sum, s) => sum + s.totalAmount, 0) }
  })

  return (
    <div className="space-y-6">
      {/* Header + filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
        <div className="flex items-center gap-2">
          <LayoutGrid size={15} className="text-slate-400 shrink-0" />
          <select
            value={selectedCartId ?? ''}
            onChange={(e) => setSelectedCartId(e.target.value === '' ? undefined : Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            <option value="">Negocio general</option>
            {activeCarts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Global alerts */}

      {/* ── Turnos en curso ── */}
      {(openShifts.length > 0 || cartsWithoutShift.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
              <PlayCircle size={16} className="text-blue-500" />
              Turnos en curso
            </div>
            <Link to="/shifts" className="text-xs text-violet-600 font-medium underline">
              Ver todos →
            </Link>
          </div>

          {openShifts.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {openShifts.map((shift) => (
                <li key={shift.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm text-slate-800">{shift.sellerName}</span>
                      <span className="text-xs text-slate-400">· {shift.cartName}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Desde las {new Date(shift.openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <ShiftElapsed openedAt={shift.openedAt} />
                </li>
              ))}
            </ul>
          )}

          {cartsWithoutShift.length > 0 && (
            <div className={`px-4 py-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 ${openShifts.length > 0 ? 'border-t border-amber-100' : ''}`}>
              <AlertTriangle size={14} className="shrink-0 text-amber-500" />
              <span>
                Sin turno activo:{' '}
                <span className="font-medium">{cartsWithoutShift.map((c) => c.name).join(', ')}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Fondos insuficientes para resurtidos (operación crítica) ── */}
      {insufficientFunds && (
        <div className="bg-red-600 text-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-base">
              <BanknoteIcon size={20} className="shrink-0" />
              <span>Fondos insuficientes para resurtir bodega</span>
            </div>
            <Link to="/purchase-orders" className="text-xs text-red-100 font-semibold underline shrink-0">
              Ver resurtidos →
            </Link>
          </div>
          <p className="text-sm text-red-100 mt-1.5">
            Tienes{' '}
            <span className="font-semibold text-white">
              {pendingDraftOrders.length} {pendingDraftOrders.length === 1 ? 'orden pendiente' : 'órdenes pendientes'}
            </span>
            {' '}por{' '}
            <span className="font-semibold text-white">
              {totalDraftCost.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </span>
            {' '}pero tu caja general solo tiene{' '}
            <span className="font-semibold text-white">
              {cashBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </span>.
            {' '}Faltan{' '}
            <span className="font-bold text-yellow-200">
              {fundingShortfall.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </span>
            {' '}para poder confirmar. Sin resurtido no hay insumos para vender.
          </p>
        </div>
      )}

      {/* ── Requisiciones pendientes de aprobación (bloquean la operación) ── */}
      {pendingReqs.length > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-orange-700 font-semibold">
              <Truck size={18} className="shrink-0" />
              <span>
                {pendingReqs.length === 1
                  ? '1 requisición esperando aprobación'
                  : `${pendingReqs.length} requisiciones esperando aprobación`}
              </span>
            </div>
            <Link to="/requisitions" className="text-xs text-orange-600 font-semibold underline shrink-0">
              Aprobar →
            </Link>
          </div>
          <ul className="mt-2 space-y-1">
            {pendingReqs.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm text-orange-700">
                <span>
                  <span className="font-medium">{r.cartName}</span>
                  {r.requestedByName && <span className="text-orange-500"> · {r.requestedByName}</span>}
                </span>
                <span className="text-xs text-orange-500">{r.items.length} insumo{r.items.length !== 1 ? 's' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Requisiciones aprobadas pendientes de despacho ── */}
      {approvedReqs.length > 0 && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <Truck size={18} className="shrink-0" />
              <span>
                {approvedReqs.length === 1
                  ? '1 requisición lista para despachar'
                  : `${approvedReqs.length} requisiciones listas para despachar`}
              </span>
            </div>
            <Link to="/requisitions" className="text-xs text-green-600 font-semibold underline shrink-0">
              Despachar →
            </Link>
          </div>
          <ul className="mt-2 space-y-1">
            {approvedReqs.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm text-green-700">
                <span>
                  <span className="font-medium">{r.cartName}</span>
                  {r.requestedByName && <span className="text-green-500"> · {r.requestedByName}</span>}
                </span>
                <span className="text-xs text-green-500">{r.items.length} insumo{r.items.length !== 1 ? 's' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Requisiciones con discrepancia sin resolver ── */}
      {discrepancyReqs.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-yellow-700 font-semibold">
              <AlertTriangle size={18} className="shrink-0" />
              <span>
                {discrepancyReqs.length === 1
                  ? '1 requisición con discrepancia sin resolver'
                  : `${discrepancyReqs.length} requisiciones con discrepancia`}
              </span>
            </div>
            <Link to="/requisitions" className="text-xs text-yellow-600 font-semibold underline shrink-0">
              Resolver →
            </Link>
          </div>
          <ul className="mt-2 space-y-1">
            {discrepancyReqs.map((r) => (
              <li key={r.id} className="text-sm text-yellow-700">
                <span className="font-medium">{r.cartName}</span>
                {r.requestedByName && <span className="text-yellow-500"> · {r.requestedByName}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

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
                    {diff === 0
                      ? 'Cuadra'
                      : diff > 0
                        ? `+${s.difference?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} sobrante`
                        : `${s.difference?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} faltante`}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

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

      {/* KPI Cards — fila 1: ventas + margen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="text-green-500" size={20} />}
          label={isCartView ? `Ventas hoy — ${selectedCart?.name}` : 'Ventas hoy'}
          value={todayTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
          color="green"
        />
        <KpiCard
          icon={<ShoppingBag className="text-violet-500" size={20} />}
          label={isCartView ? `Transacciones — ${selectedCart?.name}` : 'Transacciones hoy'}
          value={todaySales.length.toString()}
          color="violet"
        />
        {isCartView ? (
          <>
            <KpiCard
              icon={<AlertTriangle className="text-red-500" size={20} />}
              label="Insumos críticos (< 1 día)"
              value={criticalItems.length.toString()}
              color="red"
            />
            <KpiCard
              icon={<AlertTriangle className="text-amber-500" size={20} />}
              label="Insumos bajos (< 3 días)"
              value={lowItems.length.toString()}
              color="amber"
            />
          </>
        ) : (
          <>
            <KpiCard
              icon={<ShoppingBag className="text-blue-500" size={20} />}
              label="Carritos activos"
              value={activeCarts.length.toString()}
              color="blue"
            />
            <KpiCard
              icon={<AlertTriangle className="text-red-500" size={20} />}
              label="Stock bajo mínimo"
              value={lowStock.length.toString()}
              color="red"
            />
          </>
        )}
      </div>

      {/* KPI Cards — fila 2: rentabilidad del día */}
      {dailySummary && dailySummary.todayTransactionCount > 0 && (
        <MarginSummaryCard summary={dailySummary} />
      )}

      {/* Stock alerts */}
      {!isCartView && lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-3">
            <AlertTriangle size={18} /> Insumos bajo mínimo — Bodega general
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

      {isCartView && (criticalItems.length > 0 || lowItems.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-slate-700 font-semibold text-sm">
            <AlertTriangle size={16} className="text-amber-500" />
            Insumos con stock bajo — {selectedCart?.name}
            <span className="ml-auto text-xs text-slate-400 font-normal">Basado en últimos 30 días</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {[...criticalItems, ...lowItems].map((item) => {
              const unitLabel = item.unitType === 'PIECE' ? 'pza' : item.unitType === 'GRAM' ? 'g' : 'ml'
              const isCritical = item.status === 'CRITICAL'
              return (
                <li key={item.inventoryItemId} className={`flex items-center justify-between px-4 py-2.5 text-sm ${isCritical ? 'bg-red-50/50' : 'bg-amber-50/30'}`}>
                  <span className={`font-medium ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{item.currentCartStock.toFixed(1)} {unitLabel}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.estimatedDaysRemaining !== null ? `${item.estimatedDaysRemaining.toFixed(1)}d` : '—'}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Per-cart breakdown — general view only */}
      {!isCartView && (
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
                  <span className="font-bold text-green-600">
                    {cart.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                  </span>
                </div>
              </div>
            ))}
            {activeCarts.length === 0 && (
              <p className="text-slate-400 text-sm col-span-full">No hay carritos registrados aún.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string
  color: 'green' | 'violet' | 'blue' | 'red' | 'amber'
}) {
  const bg = { green: 'bg-green-50', violet: 'bg-violet-50', blue: 'bg-blue-50', red: 'bg-red-50', amber: 'bg-amber-50' }
  return (
    <div className={`${bg[color]} rounded-xl p-4`}>
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function ShiftElapsed({ openedAt }: { openedAt: string }) {
  const opened = new Date(openedAt)
  const diffMs = Date.now() - opened.getTime()
  const totalMins = Math.floor(diffMs / 60_000)
  const hours = Math.floor(totalMins / 60)
  const mins  = totalMins % 60
  const label = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  const isLong = totalMins > 480 // más de 8 horas → puede ser que olvidó cerrar

  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
      isLong ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
    }`}>
      {label}
    </span>
  )
}

function MarginSummaryCard({ summary }: { summary: DailySummary }) {
  const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
  const pct = summary.todayGrossMarginPct

  const { barColor, badgeClass, label } = pct >= 50
    ? { barColor: 'bg-green-500',  badgeClass: 'bg-green-100 text-green-700',   label: 'Excelente' }
    : pct >= 30
    ? { barColor: 'bg-teal-500',   badgeClass: 'bg-teal-100 text-teal-700',     label: 'Bueno' }
    : pct >= 15
    ? { barColor: 'bg-amber-500',  badgeClass: 'bg-amber-100 text-amber-700',   label: 'Regular' }
    : { barColor: 'bg-red-500',    badgeClass: 'bg-red-100 text-red-700',       label: 'Bajo' }

  // ── vs ayer ──────────────────────────────────────────────────────────────────
  const yesterday = summary.yesterdayRevenue ?? 0
  const vsYesterday: { pct: number; up: boolean; hasData: boolean } = yesterday > 0
    ? {
        pct: Math.abs(((summary.todayRevenue - yesterday) / yesterday) * 100),
        up: summary.todayRevenue >= yesterday,
        hasData: true,
      }
    : { pct: 0, up: true, hasData: false }

  // ── Minigráfica 7 días ────────────────────────────────────────────────────────
  const bars = summary.last7DaysRevenue ?? []
  const maxBar = Math.max(...bars, 1)
  const BAR_H = 28

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-600">Rentabilidad de hoy</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
          {label} · {pct.toFixed(1)}% margen bruto
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Ingresos</div>
          <div className="text-base font-bold text-slate-800">{fmt(summary.todayRevenue)}</div>
          {vsYesterday.hasData ? (
            <div className={`text-xs font-semibold mt-0.5 ${vsYesterday.up ? 'text-green-600' : 'text-red-500'}`}>
              {vsYesterday.up ? '▲' : '▼'} {vsYesterday.pct.toFixed(1)}% vs ayer
            </div>
          ) : (
            <div className="text-xs text-slate-400 mt-0.5">sin datos de ayer</div>
          )}
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Costo estimado</div>
          <div className="text-base font-bold text-slate-600">{fmt(summary.todayEstimatedCogs)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Ganancia bruta</div>
          <div className={`text-base font-bold ${summary.todayGrossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(summary.todayGrossProfit)}
          </div>
        </div>
      </div>

      {/* barra de margen */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Minigráfica últimos 7 días */}
      {bars.some(v => v > 0) && (
        <div>
          <div className="text-xs text-slate-400 mb-1.5">Últimos 7 días</div>
          <div className="flex items-end gap-1" style={{ height: BAR_H }}>
            {bars.map((v, i) => {
              const h = Math.max(Math.round((v / maxBar) * BAR_H), v > 0 ? 3 : 1)
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative">
                  <div
                    className="w-full rounded-sm bg-violet-400 group-hover:bg-violet-600 transition-colors"
                    style={{ height: h }}
                  />
                  {/* tooltip on hover */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10
                    bg-slate-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap pointer-events-none">
                    {fmt(v)}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-slate-300">hace 7d</span>
            <span className="text-[9px] text-slate-300">ayer</span>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-2">
        Basado en costo de recetas · Solo ventas completadas
      </p>
    </div>
  )
}
