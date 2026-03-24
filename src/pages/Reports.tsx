import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFinancialReport, getStartPeriod, getProductProfitability } from '../api/reports'
import { getCarts } from '../api/carts'
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3,
  Package, Users, Warehouse, Receipt, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react'

const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const pct = (n: number) => `${n.toFixed(1)}%`

const now = new Date()

type Tab = 'financial' | 'products'

function marginColor(pct: number) {
  if (pct >= 50) return { badge: 'bg-green-100 text-green-700', bar: 'bg-green-500' }
  if (pct >= 30) return { badge: 'bg-teal-100 text-teal-700',  bar: 'bg-teal-500'  }
  if (pct >= 15) return { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' }
  if (pct >= 0)  return { badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' }
  return           { badge: 'bg-red-100 text-red-700',    bar: 'bg-red-500'   }
}

export default function Reports() {
  const [tab, setTab]     = useState<Tab>('financial')
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [cartId, setCartId] = useState<number | undefined>(undefined)

  const MONTHS = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
  ]

  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const { data: startPeriod } = useQuery({ queryKey: ['start-period'], queryFn: getStartPeriod })

  const startYear  = startPeriod?.startYear  ?? now.getFullYear()
  const startMonth = startPeriod?.startMonth ?? 1
  const availableYears = Array.from(
    { length: now.getFullYear() - startYear + 1 },
    (_, i) => startYear + i
  )
  const availableMonths = MONTHS.map((name, i) => ({ value: i + 1, name })).filter(({ value }) => {
    if (year === startYear && value < startMonth) return false
    if (year === now.getFullYear() && value > now.getMonth() + 1) return false
    return true
  })

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['report-financial', year, month, cartId],
    queryFn: () => getFinancialReport(year, month, cartId),
  })

  const { data: profitability = [], isLoading: loadingProfitability, isError: profitabilityError, error: profitabilityErrorObj } = useQuery({
    queryKey: ['product-profitability'],
    queryFn: getProductProfitability,
    enabled: tab === 'products',
    retry: 1,
  })

  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)

  const profitable = (report?.netProfit ?? 0) >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-violet-600" />
        <h2 className="text-xl font-bold text-slate-800">Reportes</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('financial')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'financial'
              ? 'bg-white text-violet-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Reporte financiero
        </button>
        <button
          onClick={() => setTab('products')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'products'
              ? 'bg-white text-violet-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Rentabilidad por producto
        </button>
      </div>

      {/* ── TAB: REPORTE FINANCIERO ─────────────────────────────────────────── */}
      {tab === 'financial' && (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Año</label>
              <select value={year}
                onChange={(e) => {
                  const y = Number(e.target.value)
                  setYear(y)
                  if (y === startYear && month < startMonth) setMonth(startMonth)
                  if (y === now.getFullYear() && month > now.getMonth() + 1) setMonth(now.getMonth() + 1)
                }}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500">
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Mes</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500">
                {availableMonths.map(({ value, name }) => <option key={value} value={value}>{name}</option>)}
              </select>
            </div>
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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-700">{report.monthLabel}</h3>
                {report.reportScope === 'CART' && report.cartName ? (
                  <span className="text-sm bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Warehouse size={12} /> {report.cartName}
                  </span>
                ) : (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Negocio completo</span>
                )}
              </div>

              {report.reportScope === 'CART' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <strong>Reporte por punto de venta:</strong> incluye ventas, nómina del personal asignado y gastos operativos de este carrito.
                  Los resurtidos de inventario son un costo compartido del negocio y se reflejan en el reporte general.
                </div>
              )}

              {/* KPIs */}
              <div className={`grid gap-4 ${report.reportScope === 'GENERAL' ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-2 lg:grid-cols-5'}`}>
                <KpiCard
                  icon={<TrendingUp size={18} className="text-green-600" />}
                  label="Ventas"
                  value={fmt(report.totalSales)}
                  sub={`${report.saleCount} venta${report.saleCount !== 1 ? 's' : ''}`}
                  color="green"
                />
                <KpiCard
                  icon={<Package size={18} className="text-teal-600" />}
                  label="Utilidad bruta"
                  value={fmt(report.estimatedGrossProfit)}
                  sub={`${pct(report.estimatedGrossMarginPct)} margen bruto`}
                  color="teal"
                />
                {report.reportScope === 'GENERAL' && (
                  <KpiCard
                    icon={<Package size={18} className="text-amber-600" />}
                    label="Resurtidos"
                    value={fmt(report.totalRestocking)}
                    sub={`${report.purchaseOrderCount} orden${report.purchaseOrderCount !== 1 ? 'es' : ''}`}
                    color="amber"
                  />
                )}
                <KpiCard
                  icon={<Users size={18} className="text-blue-600" />}
                  label="Nómina pagada"
                  value={fmt(report.totalPayroll)}
                  sub={`${report.payrollPaymentCount} pago${report.payrollPaymentCount !== 1 ? 's' : ''}`}
                  color="blue"
                />
                <KpiCard
                  icon={<Receipt size={18} className="text-orange-500" />}
                  label="Gastos operativos"
                  value={fmt(report.totalOperationalExpenses)}
                  sub={`${report.operationalExpenseCount} gasto${report.operationalExpenseCount !== 1 ? 's' : ''}`}
                  color="orange"
                />
                <KpiCard
                  icon={profitable
                    ? <DollarSign size={18} className="text-violet-600" />
                    : <TrendingDown size={18} className="text-red-500" />}
                  label={report.reportScope === 'CART' ? 'Margen del carrito' : 'Flujo neto'}
                  value={fmt(report.netProfit)}
                  sub={`${report.profitMarginPct.toFixed(1)}% margen neto`}
                  color={profitable ? 'violet' : 'red'}
                />
              </div>

              {/* Punto de Equilibrio */}
              <BreakEvenCard report={report} />

              {/* Barra de distribución */}
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
                    {report.restockingIncluded && report.totalRestocking > 0 && (
                      <div className="bg-amber-400 flex items-center justify-center text-amber-900"
                        style={{ width: `${(report.totalRestocking / report.totalSales) * 100}%` }}>
                        {(report.totalRestocking / report.totalSales) * 100 >= 8 ? 'Resurtido' : ''}
                      </div>
                    )}
                    {report.totalPayroll > 0 && (
                      <div className="bg-blue-400 flex items-center justify-center text-blue-900"
                        style={{ width: `${(report.totalPayroll / report.totalSales) * 100}%` }}>
                        {(report.totalPayroll / report.totalSales) * 100 >= 8 ? 'Nómina' : ''}
                      </div>
                    )}
                    {report.totalOperationalExpenses > 0 && (
                      <div className="bg-orange-400 flex items-center justify-center text-orange-900 flex-1">
                        {(report.totalOperationalExpenses / report.totalSales) * 100 >= 8 ? 'Operativos' : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" /> {report.reportScope === 'CART' ? 'Margen' : 'Utilidad'} {fmt(report.netProfit)}</span>
                    {report.restockingIncluded && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Resurtido {fmt(report.totalRestocking)}</span>}
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Nómina {fmt(report.totalPayroll)}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> Operativos {fmt(report.totalOperationalExpenses)}</span>
                  </div>
                </div>
              )}

              {/* Resumen financiero */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Resumen financiero</p>
                <div className="space-y-2 text-sm">
                  <Row label="Ingresos por ventas"     value={fmt(report.totalSales)}               color="text-green-700" />
                  <Row label="− Costo de lo vendido (COGS est.)" value={fmt(report.estimatedCogs)} color="text-teal-700" />
                  <div className="border-t border-slate-100 pt-2 mt-1">
                    <Row label="= Utilidad bruta"
                      value={`${fmt(report.estimatedGrossProfit)} (${pct(report.estimatedGrossMarginPct)})`}
                      color="text-teal-700 font-semibold" />
                  </div>
                  <div className="pt-2">
                    {report.restockingIncluded && (
                      <Row label="− Costos de resurtido" value={fmt(report.totalRestocking)} color="text-amber-700" />
                    )}
                    <Row label="− Pagos de nómina"     value={fmt(report.totalPayroll)}              color="text-blue-700"  />
                    <Row label="− Gastos operativos"   value={fmt(report.totalOperationalExpenses)}  color="text-orange-600" />
                  </div>
                  <div className="border-t border-slate-200 pt-2 mt-2">
                    <Row label={report.reportScope === 'CART' ? '= Margen del carrito' : '= Flujo neto'}
                      value={fmt(report.netProfit)}
                      color={profitable ? 'text-violet-700 font-bold' : 'text-red-600 font-bold'} />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  * COGS estimado con base en los costos promedio actuales de las recetas.
                </p>
              </div>

              {/* Detalle resurtidos */}
              {report.restockingIncluded && report.purchaseOrders.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Resurtidos del mes</p>
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
              )}

              {/* Detalle nómina */}
              {report.payrollPayments.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Pagos de nómina del mes</p>
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
              )}

              {/* Detalle gastos operativos */}
              {report.operationalExpenses.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Gastos operativos del mes</p>
                  <div className="grid grid-cols-[80px_1fr_1fr_90px] gap-2 text-xs text-slate-400 px-1 mb-1">
                    <span>Fecha</span><span>Descripción</span><span>Registrado por</span><span className="text-right">Monto</span>
                  </div>
                  {report.operationalExpenses.map((e) => (
                    <div key={e.id} className="grid grid-cols-[80px_1fr_1fr_90px] gap-2 items-center py-2 border-b border-slate-100 text-sm">
                      <span className="text-slate-500 text-xs">
                        {new Date(e.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                      </span>
                      <div className="min-w-0">
                        <span className="font-medium text-slate-700">{e.description}</span>
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {e.category && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{e.category}</span>
                          )}
                          {e.cartName
                            ? <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{e.cartName}</span>
                            : <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">General</span>
                          }
                        </div>
                      </div>
                      <span className="text-slate-500 text-xs truncate">{e.createdByName ?? '—'}</span>
                      <span className="text-right font-semibold text-orange-600">{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {report.totalSales === 0 && report.totalRestocking === 0 && report.totalPayroll === 0 && report.totalOperationalExpenses === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm">
                  Sin movimientos en {report.monthLabel}.
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── TAB: RENTABILIDAD POR PRODUCTO ──────────────────────────────────── */}
      {tab === 'products' && (
        <>
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-500">
              Análisis de utilidad por producto basado en los costos promedio actuales de cada receta.
            </p>
          </div>

          {loadingProfitability && <p className="text-slate-400 text-sm">Calculando rentabilidad...</p>}

          {profitabilityError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Error al cargar el reporte de rentabilidad.</p>
                <p className="text-xs text-red-500 mt-0.5">
                  {(profitabilityErrorObj as any)?.response?.data?.message ?? (profitabilityErrorObj as any)?.message ?? 'Error interno del servidor'}
                </p>
              </div>
            </div>
          )}

          {!loadingProfitability && !profitabilityError && profitability.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">
              No hay productos activos configurados.
            </div>
          )}

          {profitability.length > 0 && (
            <>
              {/* Leyenda de colores */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">≥ 50% Excelente</span>
                <span className="bg-teal-100 text-teal-700 px-2 py-1 rounded-full">30–50% Bueno</span>
                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">15–30% Regular</span>
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full">0–15% Bajo</span>
                <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full">&lt; 0% Pérdida</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                <div className="min-w-[540px]">
                {/* Encabezados */}
                <div className="grid grid-cols-[24px_1fr_90px_90px_90px_70px] gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <span />
                  <span>Producto</span>
                  <span className="text-right">Precio venta</span>
                  <span className="text-right">Costo receta</span>
                  <span className="text-right">Utilidad</span>
                  <span className="text-right">Margen</span>
                </div>

                {profitability.map((p) => {
                  const mc       = marginColor(p.grossMarginPct)
                  const expanded = expandedProduct === p.productId
                  return (
                    <div key={p.productId} className="border-b border-slate-100 last:border-0">
                      {/* Fila principal — clickeable */}
                      <div
                        onClick={() => setExpandedProduct(expanded ? null : p.productId)}
                        className="grid grid-cols-[24px_1fr_90px_90px_90px_70px] gap-3 px-4 py-3 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {/* Chevron expand */}
                        <span className="text-slate-400">
                          {p.hasRecipe
                            ? expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                            : null}
                        </span>

                        {/* Nombre + categoría */}
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">{p.productName}</div>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {p.categoryName && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{p.categoryName}</span>
                            )}
                            {!p.hasRecipe && (
                              <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <AlertTriangle size={9} /> Sin receta
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-right text-sm text-green-700 font-semibold">{fmt(p.salePrice)}</span>
                        <span className="text-right text-sm text-slate-600">{fmt(p.estimatedCost)}</span>
                        <span className={`text-right text-sm font-semibold ${p.grossMargin >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                          {fmt(p.grossMargin)}
                        </span>
                        <div className="flex justify-end">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${mc.badge}`}>
                            {pct(p.grossMarginPct)}
                          </span>
                        </div>
                      </div>

                      {/* Panel expandido — desglose de ingredientes */}
                      {expanded && p.hasRecipe && (
                        <div className="bg-slate-50 border-t border-slate-100 px-6 pb-4 pt-3">
                          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                            Desglose de receta
                          </p>

                          {p.recipeBreakdown.length === 0 ? (
                            <p className="text-xs text-slate-400">La receta no tiene ingredientes configurados.</p>
                          ) : (
                            <>
                              <div className="overflow-x-auto">
                              <div className="min-w-[420px]">
                              {/* Sub-encabezados */}
                              <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 text-xs text-slate-400 mb-1 px-1">
                                <span>Ingrediente</span>
                                <span className="text-right">Cantidad</span>
                                <span className="text-right">CPP unitario</span>
                                <span className="text-right">Aporte</span>
                                <span className="text-right">% costo</span>
                              </div>

                              {p.recipeBreakdown.map((ing) => (
                                <div key={ing.inventoryItemId}
                                  className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 items-center py-1.5 border-b border-slate-200/60 last:border-0 text-sm px-1">
                                  <span className="text-slate-700 font-medium truncate">{ing.name}</span>
                                  <span className="text-right text-slate-500 text-xs">
                                    {ing.quantityRequired} <span className="text-slate-400">{unitLabel(ing.unitType)}</span>
                                  </span>
                                  <span className="text-right text-slate-500 text-xs">{fmt(ing.averageCost)}</span>
                                  <span className="text-right text-slate-700 font-semibold text-xs">{fmt(ing.costContribution)}</span>

                                  {/* Mini barra + % */}
                                  <div className="flex items-center justify-end gap-1">
                                    <div className="w-8 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-violet-400 rounded-full"
                                        style={{ width: `${Math.min(ing.costSharePct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-500 w-8 text-right">{ing.costSharePct.toFixed(0)}%</span>
                                  </div>
                                </div>
                              ))}

                              {/* Total */}
                              <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 items-center pt-2 mt-1 border-t border-slate-300 text-sm px-1">
                                <span className="text-slate-600 font-semibold">Total costo receta</span>
                                <span /><span />
                                <span className="text-right font-bold text-slate-800">{fmt(p.estimatedCost)}</span>
                                <span className="text-right text-xs text-slate-400">100%</span>
                              </div>

                              </div>{/* min-w */}
                              </div>{/* overflow-x-auto */}

                              {/* Precio venta vs costo */}
                              <div className="mt-3 flex items-center gap-3 flex-wrap">
                                <div className="flex-1 min-w-48">
                                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                                    <span>Costo</span>
                                    <span>Precio venta</span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${marginColor(p.grossMarginPct).bar}`}
                                      style={{ width: `${Math.min(p.grossMarginPct, 100)}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-xs mt-0.5">
                                    <span className="text-slate-500">{fmt(p.estimatedCost)}</span>
                                    <span className="text-green-700 font-semibold">{fmt(p.salePrice)}</span>
                                  </div>
                                </div>
                                <div className={`text-center px-3 py-2 rounded-lg ${marginColor(p.grossMarginPct).badge}`}>
                                  <div className="text-lg font-bold">{pct(p.grossMarginPct)}</div>
                                  <div className="text-xs">margen</div>
                                </div>
                              </div>

                              {/* Modificadores: variación de costo por opción */}
                              {p.modifierGroups && p.modifierGroups.length > 0 && (
                                <div className="mt-4">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Impacto por variante
                                  </p>
                                  <div className="space-y-3">
                                    {p.modifierGroups.map(group => (
                                      <div key={group.groupId}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <span className="text-xs font-semibold text-slate-700">{group.groupName}</span>
                                          {group.required && (
                                            <span className="text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">requerido</span>
                                          )}
                                          <span className="text-xs text-slate-400 ml-auto">
                                            costo adicional: {fmt(group.minIngredientCost)} – {fmt(group.maxIngredientCost)}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-[1fr_80px_80px_70px] gap-2 text-xs text-slate-400 px-1 mb-1">
                                          <span>Opción</span>
                                          <span className="text-right">+precio cliente</span>
                                          <span className="text-right">+costo ingr.</span>
                                          <span className="text-right">margen real</span>
                                        </div>
                                        {group.options.map(opt => {
                                          const realPrice  = p.salePrice + opt.priceAdjustment
                                          const realCost   = p.estimatedCost + opt.ingredientCost
                                          const realMargin = realPrice > 0 ? ((realPrice - realCost) / realPrice) * 100 : 0
                                          const mc         = marginColor(realMargin)
                                          return (
                                            <div key={opt.modifierId}
                                              className="grid grid-cols-[1fr_80px_80px_70px] gap-2 items-center py-1.5 border-b border-slate-200/60 last:border-0 text-sm px-1">
                                              <span className="text-slate-700 font-medium">{opt.modifierName}</span>
                                              <span className="text-right text-xs text-green-600 font-medium">
                                                {opt.priceAdjustment > 0 ? `+${fmt(opt.priceAdjustment)}` : '—'}
                                              </span>
                                              <span className="text-right text-xs text-slate-500">{fmt(opt.ingredientCost)}</span>
                                              <div className="flex justify-end">
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${mc.badge}`}>
                                                  {pct(realMargin)}
                                                </span>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                </div>{/* min-w */}
                </div>{/* overflow-x-auto */}
              </div>

              {/* Nota */}
              <p className="text-xs text-slate-400">
                * El costo de receta usa el Costo Promedio Ponderado (CPP) actual de cada ingrediente.
                Actualiza los costos de insumos al hacer resurtidos para mantener este análisis preciso.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}

function unitLabel(unitType: string) {
  if (unitType === 'GRAM')       return 'g'
  if (unitType === 'MILLILITER') return 'ml'
  return 'pza'
}

function BreakEvenCard({ report }: { report: import('../types').FinancialReport }) {
  const { breakEvenRevenue, salesAboveBreakEven, breakEvenProgressPct, totalSales } = report
  const isCart = report.reportScope === 'CART'

  // No calculable: margen <= 0
  if (breakEvenRevenue === null) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base font-bold text-red-700">Punto de Equilibrio</span>
        </div>
        <p className="text-sm text-red-600">
          No calculable: el margen de contribución es cero o negativo.
          Revisa los precios de venta y los costos de recetas.
        </p>
      </div>
    )
  }

  // Sin costos fijos
  if (breakEvenRevenue === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <p className="text-sm font-bold text-green-700 mb-0.5">Punto de Equilibrio</p>
        <p className="text-sm text-green-600">Sin costos fijos registrados — cualquier venta genera ganancia.</p>
      </div>
    )
  }

  const reached = salesAboveBreakEven >= 0
  const pctDisplay = Math.min(breakEvenProgressPct, 100)

  return (
    <div className={`rounded-xl border p-5 ${reached ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className={`text-sm font-bold ${reached ? 'text-green-800' : 'text-amber-800'}`}>
            Punto de Equilibrio {isCart ? `— ${report.cartName}` : ''}
          </p>
          <p className={`text-xs mt-0.5 ${reached ? 'text-green-600' : 'text-amber-600'}`}>
            Ventas mínimas para cubrir costos fijos del mes
          </p>
        </div>
        <span className={`text-2xl font-bold ${reached ? 'text-green-700' : 'text-amber-700'}`}>
          {fmt(breakEvenRevenue)}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-white/60 rounded-full h-4 overflow-hidden border border-white/80 mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 text-xs font-bold text-white ${reached ? 'bg-green-500' : 'bg-amber-400'}`}
          style={{ width: `${pctDisplay}%`, minWidth: pctDisplay > 0 ? '2rem' : '0' }}
        >
          {pctDisplay >= 15 ? `${pctDisplay.toFixed(0)}%` : ''}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs flex-wrap gap-1">
        <span className={reached ? 'text-green-700' : 'text-amber-700'}>
          {reached
            ? `✓ Superado — ${fmt(salesAboveBreakEven)} sobre el equilibrio`
            : `Faltan ${fmt(Math.abs(salesAboveBreakEven))} para alcanzar el equilibrio`
          }
        </span>
        <span className={`font-medium ${reached ? 'text-green-600' : 'text-amber-600'}`}>
          {fmt(totalSales)} / {fmt(breakEvenRevenue)}
        </span>
      </div>

      {!reached && (
        <p className="text-xs text-amber-600 mt-2">
          Con el margen actual de <strong>{pct(report.estimatedGrossMarginPct)}</strong>,
          cada peso vendido contribuye <strong>{pct(report.estimatedGrossMarginPct)}</strong> a cubrir
          los costos fijos de <strong>{fmt(report.totalPayroll + report.totalOperationalExpenses + (report.restockingIncluded ? report.totalRestocking : 0))}</strong>.
        </p>
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
  color: 'green' | 'amber' | 'violet' | 'blue' | 'red' | 'orange' | 'teal'
}) {
  const bg: Record<typeof color, string> = {
    green: 'bg-green-50', amber: 'bg-amber-50',
    violet: 'bg-violet-50', blue: 'bg-blue-50', red: 'bg-red-50',
    orange: 'bg-orange-50', teal: 'bg-teal-50',
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
