import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSalesByRange, cancelSale } from '../api/sales'
import { getCarts } from '../api/carts'
import { getTenantProfile } from '../api/tenant'
import type { Sale } from '../types'
import { XCircle, ChevronDown, ChevronUp } from 'lucide-react'

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59`
  return { from, to }
}

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

// ── Component ─────────────────────────────────────────────────────────────────
export default function Sales() {
  const qc = useQueryClient()

  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)   // 1-12
  const [cartFilter, setCartFilter] = useState<number | undefined>()
  const [expanded, setExpanded] = useState<number | null>(null)

  const { from, to } = monthBounds(year, month)

  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const { data: tenant } = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile })
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', year, month, cartFilter],
    queryFn: () => getSalesByRange(from, to, cartFilter),
  })

  const cancelMut = useMutation({
    mutationFn: cancelSale,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  })

  // Límites de navegación basados en la fecha de registro del negocio
  const registeredAt  = tenant ? new Date(tenant.createdAt) : new Date(now.getFullYear(), 0, 1)
  const minYear       = registeredAt.getFullYear()
  const minMonthOfMin = registeredAt.getMonth() + 1   // 1-12
  const maxYear       = now.getFullYear()
  const maxMonthOfMax = now.getMonth() + 1

  const availableYears = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => minYear + i,
  )

  const availableMonths = MONTH_NAMES.map((name, i) => {
    const m = i + 1
    if (year === minYear && m < minMonthOfMin) return null
    if (year === maxYear && m > maxMonthOfMax) return null
    return { value: m, label: name }
  }).filter(Boolean) as { value: number; label: string }[]

  // Si el mes seleccionado queda fuera del rango al cambiar año, lo corregimos
  const handleYearChange = (newYear: number) => {
    setYear(newYear)
    const minM = newYear === minYear ? minMonthOfMin : 1
    const maxM = newYear === maxYear ? maxMonthOfMax : 12
    if (month < minM) setMonth(minM)
    else if (month > maxM) setMonth(maxM)
  }

  const completedSales = sales.filter(s => s.status === 'COMPLETED')
  const totalRevenue   = completedSales.reduce((acc, s) => acc + s.totalAmount, 0)
  const cancelledCount = sales.filter(s => s.status === 'CANCELLED').length

  const toggle = (id: number) => setExpanded(expanded === id ? null : id)

  return (
    <div className="space-y-4">
      {/* ── Encabezado ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Ventas</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Selectores de mes y año */}
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-violet-500"
          >
            {availableMonths.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-violet-500"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Filtro por carrito */}
          <select
            value={cartFilter || ''}
            onChange={(e) => setCartFilter(e.target.value ? parseInt(e.target.value) : undefined)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos los PDVs</option>
            {carts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Resumen del periodo ───────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">Ventas completadas</p>
            <p className="text-xl font-bold text-slate-800">{completedSales.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">Total del mes</p>
            <p className="text-xl font-bold text-green-600">{fmt(totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">Canceladas</p>
            <p className={`text-xl font-bold ${cancelledCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {cancelledCount}
            </p>
          </div>
        </div>
      )}

      {/* ── Lista ────────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="text-slate-400 text-sm">Cargando...</div>
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">
          No hay ventas en {MONTH_NAMES[month - 1]} {year}.
        </div>
      ) : (
        <div className="space-y-2">
          {sales.map((sale: Sale) => (
            <div key={sale.id} className={`bg-white rounded-xl border ${
              sale.status === 'CANCELLED' ? 'border-slate-200 opacity-60' : 'border-slate-200'
            }`}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 rounded-xl"
                onClick={() => toggle(sale.id)}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 text-sm">#{sale.id}</span>
                      <span className="text-xs text-slate-400">{sale.cartName}</span>
                      {sale.status === 'CANCELLED' && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          Cancelada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(sale.soldAt).toLocaleString('es-MX')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${sale.status === 'CANCELLED' ? 'line-through text-slate-400' : 'text-green-600'}`}>
                    {fmt(sale.totalAmount)}
                  </span>
                  {expanded === sale.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {expanded === sale.id && (
                <div className="px-4 pb-4 border-t border-slate-100">
                  <table className="w-full text-sm mt-3">
                    <thead>
                      <tr className="text-xs text-slate-400">
                        <th className="text-left pb-2">Producto</th>
                        <th className="text-center pb-2">Cant.</th>
                        <th className="text-right pb-2">Precio</th>
                        <th className="text-right pb-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sale.items.map((item, i) => (
                        <tr key={i}>
                          <td className="py-1.5 text-slate-700">{item.productName}</td>
                          <td className="py-1.5 text-center text-slate-500">{item.quantity}</td>
                          <td className="py-1.5 text-right text-slate-500">{fmt(item.unitPrice)}</td>
                          <td className="py-1.5 text-right font-medium text-slate-700">{fmt(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {sale.status === 'COMPLETED' && (
                    <button
                      onClick={() => cancelMut.mutate(sale.id)}
                      disabled={cancelMut.isPending}
                      className="mt-3 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      <XCircle size={14} /> Cancelar venta
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
