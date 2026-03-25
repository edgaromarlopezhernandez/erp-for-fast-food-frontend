import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder,
  confirmPurchaseOrder, cancelPurchaseOrder, getPurchaseSuggestions,
} from '../api/purchaseOrders'
import { getInventory } from '../api/inventory'
import type {
  PurchaseOrder, PurchaseOrderStatus, PurchaseOrderItemRequest, UnitType,
  PurchaseSuggestionItem, SuggestionUrgency,
} from '../types'
import {
  Plus, X, CheckCircle, XCircle, Eye, ShoppingBag, Trash2,
  Sparkles, AlertTriangle, TrendingUp, Info, Pencil, Save, ArrowRight,
} from 'lucide-react'

const UNIT_LABELS: Record<string, string> = {
  PIECE: 'pza', GRAM: 'g', MILLILITER: 'ml',
  KILOGRAM: 'kg', LITER: 'L',
}

const STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; className: string }> = {
  DRAFT:     { label: 'Borrador',   className: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Confirmado', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelado',  className: 'bg-slate-100 text-slate-500' },
}

const URGENCY_CONFIG: Record<SuggestionUrgency, { label: string; className: string; icon: JSX.Element }> = {
  CRITICAL: { label: 'Crítico',   className: 'bg-red-100 text-red-700',    icon: <AlertTriangle size={11} /> },
  LOW:      { label: 'Bajo',      className: 'bg-amber-100 text-amber-700', icon: <AlertTriangle size={11} /> },
  NORMAL:   { label: 'Normal',    className: 'bg-blue-100 text-blue-700',   icon: <TrendingUp size={11} /> },
  NO_DATA:  { label: 'Sin datos', className: 'bg-slate-100 text-slate-500', icon: <Info size={11} /> },
}

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const emptyLine = (): PurchaseOrderItemRequest => ({
  inventoryItemId: 0, quantity: 0, unitCost: 0,
})

// Metadata extra que se guarda junto a cada línea para mostrar el badge de urgencia y presentación
type LineSource = {
  urgency: SuggestionUrgency
  daysRemaining: number | null
  containerSize?: number
  containerLabel?: string
  containersNeeded?: number
} | null

export default function PurchaseOrders() {
  const qc = useQueryClient()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: getPurchaseOrders,
  })

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventory,
  })

  // ── Modals state ─────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]   = useState(false)
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null)

  // ── Edit-draft state ──────────────────────────────────────────────────────────
  const [editMode, setEditMode]           = useState(false)
  // editPrices[i] = string con el precio total de esa línea (lo que pagaste)
  const [editPrices, setEditPrices]       = useState<string[]>([])
  const [editQtys, setEditQtys]           = useState<string[]>([])
  const [editSupplier, setEditSupplier]   = useState('')
  const [editNotes, setEditNotes]         = useState('')

  const openEdit = (order: PurchaseOrder) => {
    setEditPrices(order.items.map((it) => (it.unitCost * it.quantity).toFixed(2)))
    setEditQtys(order.items.map((it) => String(it.quantity)))
    setEditSupplier(order.supplier ?? '')
    setEditNotes(order.notes ?? '')
    setEditMode(true)
  }

  const closeEdit = () => setEditMode(false)

  const closeDetail = () => { setDetailOrder(null); setEditMode(false) }

  // ── Create form state ─────────────────────────────────────────────────────────
  const [supplier, setSupplier]     = useState('')
  const [notes, setNotes]           = useState('')
  const [lines, setLines]           = useState<PurchaseOrderItemRequest[]>([emptyLine()])
  const [linePrices, setLinePrices] = useState<string[]>([''])
  // Metadata de sugerido para mostrar badge por línea (null = línea manual)
  const [lineSources, setLineSources] = useState<LineSource[]>([null])

  // ── Suggestion auto-fill state ────────────────────────────────────────────────
  const [isLoadingSugg, setIsLoadingSugg]     = useState(false)
  const [suggError, setSuggError]             = useState<string | null>(null)
  const [suggFilledCount, setSuggFilledCount] = useState<number | null>(null)
  const [missingPriceCount, setMissingPriceCount] = useState(0)
  const [activeMultiplier, setActiveMultiplier]   = useState<1 | 1.2 | null>(null)

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: () => createPurchaseOrder({
      supplier: supplier || undefined,
      notes: notes || undefined,
      items: lines,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      resetCreate()
    },
  })

  const updateMut = useMutation({
    mutationFn: (id: number) => {
      const items = detailOrder!.items.map((it, i) => {
        const qty      = parseFloat(editQtys[i] ?? '0') || 0
        const total    = parseFloat(editPrices[i] ?? '0') || 0
        const unitCost = qty > 0 && total > 0 ? total / qty : it.unitCost
        return { inventoryItemId: it.inventoryItemId, quantity: qty, unitCost }
      })
      return updatePurchaseOrder(id, {
        supplier: editSupplier || undefined,
        notes: editNotes || undefined,
        items,
      })
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      setDetailOrder(updated)
      setEditMode(false)
    },
  })

  const confirmMut = useMutation({
    mutationFn: (id: number) => confirmPurchaseOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      closeDetail()
    },
  })

  const cancelMut = useMutation({
    mutationFn: (id: number) => cancelPurchaseOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      closeDetail()
    },
  })

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const resetCreate = () => {
    setSupplier('')
    setNotes('')
    setLines([emptyLine()])
    setLinePrices([''])
    setLineSources([null])
    setSuggFilledCount(null)
    setSuggError(null)
    setMissingPriceCount(0)
    setActiveMultiplier(null)
    setCreateOpen(false)
  }

  const updateLine = (i: number, patch: Partial<PurchaseOrderItemRequest>) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))

  const updateLinePrice = (i: number, totalPrice: string) => {
    setLinePrices((prev) => prev.map((p, idx) => idx === i ? totalPrice : p))
    const price = parseFloat(totalPrice)
    const qty   = lines[i]?.quantity
    if (price > 0 && qty > 0) {
      updateLine(i, { unitCost: price / qty })
    }
  }

  const removeLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i))
    setLinePrices((prev) => prev.filter((_, idx) => idx !== i))
    setLineSources((prev) => prev.filter((_, idx) => idx !== i))
  }

  const addEmptyLine = () => {
    setLines((prev) => [...prev, emptyLine()])
    setLinePrices((prev) => [...prev, ''])
    setLineSources((prev) => [...prev, null])
  }

  const totalAmount = linePrices.reduce((sum, p, i) => {
    const price = parseFloat(p)
    return sum + (price > 0 && lines[i]?.inventoryItemId > 0 ? price : 0)
  }, 0)

  const canCreate = lines.length > 0 && lines.every(
    (l, i) => l.inventoryItemId > 0 && l.quantity > 0 && parseFloat(linePrices[i] ?? '') > 0,
  )

  // ── Auto-fill from suggestions ────────────────────────────────────────────────
  const applySuggestions = async (multiplier: 1 | 1.2) => {
    setIsLoadingSugg(true)
    setSuggError(null)
    setSuggFilledCount(null)
    setActiveMultiplier(null)

    try {
      const data = await getPurchaseSuggestions()

      if (data.items.length === 0) {
        setSuggError('El sistema no detecta insumos que necesiten reabastecerse ahora.')
        return
      }

      const newLines: PurchaseOrderItemRequest[] = []
      const newPrices: string[] = []
      const newSources: LineSource[] = []
      let noPriceCount = 0

      for (const item of data.items) {
        // Si hay presentación configurada, la cantidad SIEMPRE es containers × containerSize
        // para garantizar consistencia entre el badge y el campo de cantidad.
        let qty: number
        let containers: number | undefined
        if (item.containersNeeded != null && item.containerSize != null) {
          containers = Math.ceil(item.containersNeeded * multiplier)
          qty        = containers * item.containerSize
        } else {
          qty = Math.ceil(item.suggestedQuantity * multiplier)
        }

        const cost  = item.lastUnitCost ?? 0
        const total = cost > 0 ? parseFloat((qty * cost).toFixed(2)) : 0

        newLines.push({ inventoryItemId: item.inventoryItemId, quantity: qty, unitCost: cost })
        newPrices.push(total > 0 ? String(total) : '')
        newSources.push({
          urgency: item.urgency,
          daysRemaining: item.estimatedDaysRemaining,
          containerSize: item.containerSize,
          containerLabel: item.containerLabel,
          containersNeeded: containers,
        })

        if (cost === 0) noPriceCount++
      }

      setLines(newLines)
      setLinePrices(newPrices)
      setLineSources(newSources)
      setSuggFilledCount(data.items.length)
      setMissingPriceCount(noPriceCount)
      setActiveMultiplier(multiplier)
    } catch {
      setSuggError('No se pudo obtener los sugeridos. Intenta de nuevo.')
    } finally {
      setIsLoadingSugg(false)
    }
  }

  if (isLoading) return <div className="text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag size={20} className="text-violet-600" />
          <h2 className="text-xl font-bold text-slate-800">Resurtidos</h2>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          disabled={inventoryItems.length === 0}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Nuevo resurtido
        </button>
      </div>

      {/* Alerta bodega vacía */}
      {inventoryItems.length === 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">La bodega no tiene insumos registrados</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Para crear resurtidos primero debes registrar tus insumos en bodega.
              Los resurtidos se basan en el stock de bodega general para abastecer tus PDVs.
            </p>
            <a href="/inventory" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 mt-2 underline underline-offset-2">
              Ir a Bodega <ArrowRight size={12} />
            </a>
          </div>
        </div>
      )}

      {/* Orders list */}
      <div className="space-y-3">
        {orders.map((order) => {
          const cfg = STATUS_CONFIG[order.status]
          return (
            <div key={order.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{order.folio}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </div>
                  {order.supplier && (
                    <p className="text-xs text-slate-500 mt-0.5">Proveedor: {order.supplier}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(order.createdAt).toLocaleString('es-MX')} — {order.items.length} insumo{order.items.length !== 1 ? 's' : ''}
                  </p>
                  {order.createdByName && (
                    <p className="text-xs text-slate-400 mt-0.5">Creado por: <span className="font-medium text-slate-500">{order.createdByName}</span></p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-800">{fmt(order.totalAmount)}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setDetailOrder(order)}
                  className="flex items-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium py-1.5 px-3 rounded-lg transition-colors"
                >
                  <Eye size={13} /> Ver detalle
                </button>
                {order.status === 'DRAFT' && (
                  <>
                    <button
                      onClick={() => confirmMut.mutate(order.id)}
                      disabled={confirmMut.isPending}
                      className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={13} /> Confirmar
                    </button>
                    <button
                      onClick={() => cancelMut.mutate(order.id)}
                      disabled={cancelMut.isPending}
                      className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <XCircle size={13} /> Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {orders.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No hay resurtidos registrados.
          </div>
        )}
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────────── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Nuevo resurtido</h3>
              <button onClick={resetCreate}><X size={20} className="text-slate-400" /></button>
            </div>

            {/* ── Suggestion panel ──────────────────────────────────────────── */}
            <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={15} className="text-violet-600 shrink-0" />
                <span className="text-sm font-semibold text-violet-800">Rellenar automáticamente</span>
                <span className="text-xs text-violet-500 ml-auto">Basado en los últimos 30 días</span>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => applySuggestions(1)}
                  disabled={isLoadingSugg}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                    activeMultiplier === 1
                      ? 'bg-violet-700 text-white ring-2 ring-violet-400 ring-offset-1'
                      : 'bg-violet-600 hover:bg-violet-700 text-white'
                  }`}
                >
                  {isLoadingSugg && activeMultiplier !== 1.2
                    ? <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Sparkles size={13} />
                  }
                  Sugerido exacto
                </button>
                <button
                  onClick={() => applySuggestions(1.2)}
                  disabled={isLoadingSugg}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                    activeMultiplier === 1.2
                      ? 'bg-violet-600 text-white ring-2 ring-violet-400 ring-offset-1'
                      : 'bg-white hover:bg-violet-50 border border-violet-300 text-violet-700'
                  }`}
                >
                  {isLoadingSugg && activeMultiplier !== 1
                    ? <span className="inline-block w-3 h-3 border-2 border-violet-400/40 border-t-violet-600 rounded-full animate-spin" />
                    : <TrendingUp size={13} />
                  }
                  Sugerido +20%
                </button>
              </div>

              {/* Feedback messages */}
              {suggFilledCount !== null && !suggError && (
                <div className="mt-2 flex items-start gap-1.5">
                  <CheckCircle size={13} className="text-green-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-green-700">
                    {suggFilledCount} insumo{suggFilledCount !== 1 ? 's' : ''} cargado{suggFilledCount !== 1 ? 's' : ''}.
                    {missingPriceCount > 0 && (
                      <span className="text-amber-600 ml-1">
                        {missingPriceCount} sin precio anterior — completa el campo «Precio total».
                      </span>
                    )}
                  </p>
                </div>
              )}
              {suggError && (
                <div className="mt-2 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">{suggError}</p>
                </div>
              )}
            </div>

            <div className="overflow-y-auto flex-1 space-y-5 pr-1">
              {/* Proveedor y notas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Proveedor</label>
                  <input
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Nombre del proveedor (opcional)"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Notas</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Líneas de insumos — tarjetas mobile-first */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">
                    Insumos <span className="text-slate-400 font-normal">({lines.length})</span>
                  </label>
                  <button
                    onClick={addEmptyLine}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-semibold"
                  >
                    <Plus size={13} /> Agregar
                  </button>
                </div>

                <div className="space-y-3">
                  {lines.map((line, i) => {
                    const selectedItem = inventoryItems.find((it) => it.id === line.inventoryItemId)
                    const unitLabel    = selectedItem ? (UNIT_LABELS[selectedItem.unitType as UnitType] ?? '') : ''
                    const totalPrice   = parseFloat(linePrices[i] ?? '')
                    const unitCost     = totalPrice > 0 && line.quantity > 0 ? totalPrice / line.quantity : null
                    const source       = lineSources[i]

                    return (
                      <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                        {/* Fila 1: selector de insumo + botón eliminar */}
                        <div className="flex items-center gap-2">
                          <select
                            value={line.inventoryItemId || ''}
                            onChange={(e) => updateLine(i, { inventoryItemId: Number(e.target.value) })}
                            className="flex-1 border border-slate-300 bg-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-violet-500"
                          >
                            <option value="">— Seleccionar insumo —</option>
                            {inventoryItems.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name} ({UNIT_LABELS[it.unitType] ?? it.unitType})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeLine(i)}
                            disabled={lines.length === 1}
                            className="shrink-0 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Fila 2: cantidad + precio total */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">
                              Cantidad {unitLabel && <span className="text-slate-400">({unitLabel})</span>}
                            </label>
                            <input
                              type="number" min="0" step="1"
                              value={line.quantity || ''}
                              onChange={(e) => {
                                const qty   = parseFloat(e.target.value) || 0
                                const price = parseFloat(linePrices[i] ?? '')
                                updateLine(i, { quantity: qty, unitCost: price > 0 && qty > 0 ? price / qty : 0 })
                              }}
                              placeholder="0"
                              className="w-full border border-slate-300 bg-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-violet-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Precio total $</label>
                            <input
                              type="number" min="0" step="0.01"
                              value={linePrices[i] ?? ''}
                              onChange={(e) => updateLinePrice(i, e.target.value)}
                              placeholder="lo que pagaste"
                              className={`w-full border rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-violet-500 ${
                                source && !linePrices[i]
                                  ? 'border-amber-300 bg-amber-50 placeholder:text-amber-400'
                                  : 'border-slate-300 bg-white'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Fila 3: costo por unidad calculado */}
                        {unitCost !== null && (
                          <div className="flex items-center justify-end">
                            <span className="text-xs text-violet-700 font-medium bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1">
                              ${unitCost.toFixed(4)} / {unitLabel || 'u'}
                            </span>
                          </div>
                        )}

                        {/* Fila 4: badges de urgencia y presentación */}
                        {source && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 border-t border-slate-200">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${URGENCY_CONFIG[source.urgency].className}`}>
                              {URGENCY_CONFIG[source.urgency].icon}
                              {URGENCY_CONFIG[source.urgency].label}
                            </span>
                            {source.containersNeeded != null && source.containerSize != null ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                                📦 {source.containersNeeded} {source.containerLabel ?? 'envase'}{source.containersNeeded !== 1 ? 's' : ''} × {source.containerSize}{unitLabel}
                              </span>
                            ) : null}
                            {source.daysRemaining !== null && (
                              <span className="text-[10px] text-slate-400 ml-auto">
                                ~{source.daysRemaining.toFixed(1)} días en bodega
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end border-t border-slate-100 pt-3">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total del resurtido</p>
                  <p className="text-xl font-bold text-slate-800">{fmt(totalAmount)}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={resetCreate}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!canCreate || createMut.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg"
              >
                {createMut.isPending ? 'Guardando...' : 'Guardar borrador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800">{detailOrder.folio}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CONFIG[detailOrder.status].className}`}>
                    {STATUS_CONFIG[detailOrder.status].label}
                  </span>
                  {editMode && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Editando
                    </span>
                  )}
                </div>
                {!editMode && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(detailOrder.createdAt).toLocaleString('es-MX')}
                    {detailOrder.createdByName && ` — ${detailOrder.createdByName}`}
                  </p>
                )}
              </div>
              <button onClick={closeDetail}><X size={20} className="text-slate-400" /></button>
            </div>

            {/* Modo lectura: datos del encabezado */}
            {!editMode && (detailOrder.supplier || detailOrder.notes) && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600 mb-3 space-y-0.5">
                {detailOrder.supplier && <p><span className="font-medium">Proveedor:</span> {detailOrder.supplier}</p>}
                {detailOrder.notes    && <p><span className="font-medium">Notas:</span> {detailOrder.notes}</p>}
              </div>
            )}

            {/* Modo edición: proveedor y notas editables */}
            {editMode && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Proveedor</label>
                  <input value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)}
                    placeholder="Nombre del proveedor"
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Notas</label>
                  <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Opcional"
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                </div>
              </div>
            )}

            {/* Lista de ítems */}
            <div className="overflow-y-auto flex-1 space-y-2">
              {detailOrder.items.map((item, i) => {
                const unitLabel = UNIT_LABELS[item.unitType] ?? item.unitType
                if (!editMode) {
                  // Vista de solo lectura
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{item.inventoryItemName}</p>
                        <p className="text-xs text-slate-400">{item.quantity} {unitLabel}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-slate-800">{fmt(item.totalCost)}</p>
                        <p className="text-xs text-slate-400">{fmt(item.unitCost)}/{unitLabel}</p>
                      </div>
                    </div>
                  )
                }
                // Vista de edición — tarjeta
                const qty   = parseFloat(editQtys[i] ?? '0') || 0
                const total = parseFloat(editPrices[i] ?? '0') || 0
                const uc    = qty > 0 && total > 0 ? total / qty : null
                return (
                  <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="font-semibold text-slate-800 text-sm">{item.inventoryItemName}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Cantidad ({unitLabel})</label>
                        <input type="number" min="0" step="1"
                          value={editQtys[i] ?? ''}
                          onChange={(e) => setEditQtys((prev) => prev.map((v, idx) => idx === i ? e.target.value : v))}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Precio total $</label>
                        <input type="number" min="0" step="0.01"
                          value={editPrices[i] ?? ''}
                          onChange={(e) => setEditPrices((prev) => prev.map((v, idx) => idx === i ? e.target.value : v))}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                    </div>
                    {uc !== null && (
                      <p className="text-xs text-right text-violet-700 font-medium">
                        ${uc.toFixed(4)}/{unitLabel}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 mt-2">
              <span className="text-sm font-medium text-slate-600">Total</span>
              {editMode ? (
                <span className="text-xl font-bold text-amber-700">
                  {fmt(editPrices.reduce((s, p) => s + (parseFloat(p) || 0), 0))}
                </span>
              ) : (
                <span className="text-xl font-bold text-slate-800">{fmt(detailOrder.totalAmount)}</span>
              )}
            </div>

            {/* Acciones */}
            {detailOrder.status === 'DRAFT' && !editMode && (
              <div className="flex gap-2 mt-4 flex-wrap">
                <button
                  onClick={() => openEdit(detailOrder)}
                  className="flex items-center gap-1.5 border border-amber-300 text-amber-700 text-sm font-medium py-2 px-4 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <Pencil size={14} /> Actualizar precios
                </button>
                <button
                  onClick={() => cancelMut.mutate(detailOrder.id)}
                  disabled={cancelMut.isPending}
                  className="flex items-center gap-1.5 border border-red-300 text-red-600 text-sm font-medium py-2 px-4 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <XCircle size={14} /> Cancelar
                </button>
                <button
                  onClick={() => confirmMut.mutate(detailOrder.id)}
                  disabled={confirmMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-4 rounded-lg disabled:opacity-50 transition-colors"
                >
                  <CheckCircle size={14} /> {confirmMut.isPending ? 'Confirmando...' : 'Confirmar resurtido'}
                </button>
              </div>
            )}

            {editMode && (
              <div className="flex gap-3 mt-4">
                <button onClick={closeEdit}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                  Cancelar
                </button>
                <button
                  onClick={() => updateMut.mutate(detailOrder.id)}
                  disabled={updateMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  <Save size={14} /> {updateMut.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
