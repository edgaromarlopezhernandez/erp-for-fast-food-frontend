import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFinancialReport } from '../api/reports'
import { getCarts } from '../api/carts'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Package, Users, Warehouse } from 'lucide-react'

const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const now = new Date()

export default function Reports() {
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [cartId, setCartId] = useState<number | undefined>(undefined)

  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['report-financial', year, month, cartId],
    queryFn: () => getFinancialReport(year, month, cartId),
  })

  const profitable = (report?.netProfit ?? 0) >= 0

  const MONTHS = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-violet-600" />
        <h2 className="text-xl font-bold text-slate-800">Reportes financieros</h2>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Mes */}
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Mes</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500">
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>

        {/* Año */}
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Año</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500">
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Carrito */}
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1 flex items-center gap-1">
            <Warehouse size={10} /> Punto de venta
          </label>
          <select value={cartId ?? ''}
            onChange={(e) => setCartId(e.target.value ? Number(e.target.value) : undefined)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500">
            <option value="">Todos los carritos</option>
            {carts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {isLoading && <p className="text-slate-400 text-sm">Calculando...</p>}
      {isError   && <p className="text-red-500 text-sm">Error al cargar el reporte.</p>}

      {report && (
        <>
          {/* Encabezado del periodo */}
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-700">{report.monthLabel}</h3>
            {report.cartName && (
              <span className="text-sm bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Warehouse size={12} /> {report.cartName}
              </span>
            )}
            {!report.cartName && (
              <span className="text-xs text-slate-400">Todos los puntos de venta</span>
            )}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<TrendingUp size={18} className="text-green-600" />}
              label="Ventas"
              value={fmt(report.totalSales)}
              sub={`${report.saleCount} venta${report.saleCount !== 1 ? 's' : ''}`}
              color="green"
            />
            <KpiCard
              icon={<Package size={18} className="text-amber-600" />}
              label="Resurtidos"
              value={fmt(report.totalRestocking)}
              sub={`${report.purchaseOrderCount} orden${report.purchaseOrderCount !== 1 ? 'es' : ''}`}
              color="amber"
            />
            <KpiCard
              icon={<Users size={18} className="text-blue-600" />}
              label="Nómina pagada"
              value={fmt(report.totalPayroll)}
              sub={`${report.payrollPaymentCount} pago${report.payrollPaymentCount !== 1 ? 's' : ''}`}
              color="blue"
            />
            <KpiCard
              icon={profitable
                ? <DollarSign size={18} className="text-violet-600" />
                : <TrendingDown size={18} className="text-red-500" />}
              label="Flujo neto"
              value={fmt(report.netProfit)}
              sub={`${report.profitMarginPct.toFixed(1)}% margen`}
              color={profitable ? 'violet' : 'red'}
            />
          </div>

          {/* Barra de desglose de gastos */}
          {report.totalSales > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Distribución del ingreso</p>
              <div className="flex rounded-full overflow-hidden h-6 text-xs font-medium">
                {report.netProfit > 0 && (
                  <div className="bg-violet-500 flex items-center justify-center text-white"
                    style={{ width: `${Math.max(report.profitMarginPct, 0)}%` }}>
                    {report.profitMarginPct >= 8 ? `${report.profitMarginPct.toFixed(0)}%` : ''}
                  </div>
                )}
                {report.totalRestocking > 0 && (
                  <div className="bg-amber-400 flex items-center justify-center text-amber-900"
                    style={{ width: `${(report.totalRestocking / report.totalSales) * 100}%` }}>
                    {(report.totalRestocking / report.totalSales) * 100 >= 8 ? 'Resurtido' : ''}
                  </div>
                )}
                {report.totalPayroll > 0 && (
                  <div className="bg-blue-400 flex items-center justify-center text-blue-900 flex-1">
                    {(report.totalPayroll / report.totalSales) * 100 >= 8 ? 'Nómina' : ''}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" /> Utilidad {fmt(report.netProfit)}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Resurtido {fmt(report.totalRestocking)}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Nómina {fmt(report.totalPayroll)}</span>
              </div>
            </div>
          )}

          {/* Resumen de gastos */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">Resumen financiero</p>
            <div className="space-y-2 text-sm">
              <Row label="Ingresos por ventas"     value={fmt(report.totalSales)}       color="text-green-700" />
              <Row label="− Costos de resurtido"   value={fmt(report.totalRestocking)}  color="text-amber-700" />
              <Row label="− Pagos de nómina"       value={fmt(report.totalPayroll)}     color="text-blue-700"  />
              <div className="border-t border-slate-200 pt-2 mt-2">
                <Row label="= Flujo neto"
                  value={fmt(report.netProfit)}
                  color={profitable ? 'text-violet-700 font-bold' : 'text-red-600 font-bold'} />
              </div>
            </div>
          </div>

          {/* Detalle resurtidos */}
          {report.purchaseOrders.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Resurtidos del mes</p>
              <div className="space-y-0">
                <div className="grid grid-cols-[80px_1fr_1fr_90px] gap-2 text-xs text-slate-400 px-1 mb-1">
                  <span>Folio</span><span>Proveedor</span><span>Por</span><span className="text-right">Total</span>
                </div>
                {report.purchaseOrders.map((po) => (
                  <div key={po.id} className="grid grid-cols-[80px_1fr_1fr_90px] gap-2 items-center py-2 border-b border-slate-100 text-sm">
                    <span className="font-medium text-slate-700">{po.folio}</span>
                    <span className="text-slate-500 truncate">{po.supplier ?? '—'}</span>
                    <span className="text-slate-500 truncate">{po.createdByName ?? '—'}</span>
                    <span className="text-right font-semibold text-amber-700">{fmt(po.totalAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detalle nómina */}
          {report.payrollPayments.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Pagos de nómina del mes</p>
              <div className="space-y-0">
                <div className="grid grid-cols-[1fr_1fr_90px] gap-2 text-xs text-slate-400 px-1 mb-1">
                  <span>Empleado</span><span>Periodo</span><span className="text-right">Monto</span>
                </div>
                {report.payrollPayments.map((p) => (
                  <div key={p.id} className="grid grid-cols-[1fr_1fr_90px] gap-2 items-center py-2 border-b border-slate-100 text-sm">
                    <span className="font-medium text-slate-700">{p.employeeName}</span>
                    <span className="text-slate-500 text-xs truncate">{p.periodLabel}</span>
                    <span className="text-right font-semibold text-blue-700">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.totalSales === 0 && report.totalRestocking === 0 && report.totalPayroll === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">
              Sin movimientos en {report.monthLabel}.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <span className={color}>{value}</span>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string
  color: 'green' | 'amber' | 'violet' | 'blue' | 'red'
}) {
  const bg: Record<typeof color, string> = {
    green: 'bg-green-50', amber: 'bg-amber-50',
    violet: 'bg-violet-50', blue: 'bg-blue-50', red: 'bg-red-50',
  }
  return (
    <div className={`${bg[color]} rounded-xl p-4`}>
      <div className="mb-2">{icon}</div>
      <div className="text-xl font-bold text-slate-800 leading-tight">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  )
}
