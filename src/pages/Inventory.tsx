import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInventory, createInventoryItem, updateInventoryItem,
  adjustStock, getMovements, deleteInventoryItem, transferToCart,
  getCartStockAnalysis, reconcileStock, getPerishableAnalysis,
  type TransferLine,
} from '../api/inventory'
import { getCarts } from '../api/carts'
import { getTenantProfile } from '../api/tenant'
import type { InventoryItem, InventoryItemRequest, MovementType, UnitType, PerishableItemAnalysis } from '../types'
import { Plus, Pencil, TrendingUp, AlertTriangle, X, History, Trash2, Warehouse, ArrowRightLeft, BarChart2, ClipboardList, PackagePlus } from 'lucide-react'

type BulkRow = { id: number; name: string; unitType: UnitType; qty: string; price: string }

const UNIT_LABELS: Record<UnitType, string> = {
  PIECE: 'pza', GRAM: 'g', MILLILITER: 'ml',
}
const MOVE_LABELS: Record<MovementType, string> = {
  PURCHASE: 'Compra', TRANSFER_TO_CART: 'Recepción en carrito',
  TRANSIT_DISPATCHED: 'Despacho a tránsito',
  SALE_DEDUCTION: 'Venta', MANUAL_ADJUSTMENT: 'Ajuste',
  WASTE: 'Merma', RETURN: 'Devolución', OPENING_STOCK: 'Stock inicial',
}

export default function Inventory() {
  const qc = useQueryClient()

  // Location filter: undefined = bodega general | N = carrito N
  const [locationCartId, setLocationCartId] = useState<number | undefined>(undefined)
  const isCartView = locationCartId !== undefined

  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const activeCarts = carts.filter((c) => c.active)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', locationCartId],
    queryFn: () => getInventory(locationCartId),
  })

  const [itemModal, setItemModal]       = useState<{ open: boolean; item?: InventoryItem }>({ open: false })
  const [adjustModal, setAdjustModal]   = useState<{ open: boolean; item?: InventoryItem }>({ open: false })
  const [historyModal, setHistoryModal] = useState<{ open: boolean; item?: InventoryItem }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [deleteError, setDeleteError]   = useState('')

  // Transfer modal state
  const [transferModal, setTransferModal] = useState(false)
  const [transferCartId, setTransferCartId] = useState<number | undefined>(undefined)
  const [transferLines, setTransferLines] = useState<Record<number, string>>({})  // itemId → qty string
  const [transferNotes, setTransferNotes] = useState('')
  const [transferError, setTransferError] = useState('')

  // Reconcile (toma de inventario)
  const [reconcileModal, setReconcileModal] = useState(false)
  const [reconcileRows, setReconcileRows] = useState<Record<number, string>>({})
  const [reconcileNotes, setReconcileNotes] = useState('')
  const [reconcileError, setReconcileError] = useState('')

  // Bulk initial load
  const [bulkModal, setBulkModal] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([])
  const [bulkError, setBulkError] = useState('')

  const [form, setForm] = useState<InventoryItemRequest>({
    name: '', unitType: 'PIECE', minimumStock: 0, averageCost: 0,
  })
  const [costCalc, setCostCalc] = useState({ totalPrice: '', totalQty: '' })
  const [showInitialStock, setShowInitialStock] = useState(false)

  const { data: tenantProfile } = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile })
  const withinOnboardingPeriod = (() => {
    if (!tenantProfile?.createdAt) return false
    const createdAt = new Date(tenantProfile.createdAt)
    const onboardingEnd = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    return new Date() <= onboardingEnd
  })()
  const [adjust, setAdjust] = useState({ movementType: 'PURCHASE' as MovementType, quantity: 0, notes: '' })
  const [adjustCost, setAdjustCost] = useState({ totalPrice: '', totalQty: '' })

  const { data: movements = [] } = useQuery({
    queryKey: ['movements', historyModal.item?.id],
    queryFn: () => getMovements(historyModal.item!.id),
    enabled: !!historyModal.item,
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      const item = itemModal.item
        ? await updateInventoryItem(itemModal.item.id, form)
        : await createInventoryItem(form)

      if (!itemModal.item) {
        const initQty   = parseFloat(costCalc.totalQty)
        const totalPaid = parseFloat(costCalc.totalPrice)
        if (initQty > 0) {
          const unitCost = initQty > 0 && totalPaid > 0 ? totalPaid / initQty : undefined
          // Stock inicial: establece CPP y cantidad sin afectar el balance de caja.
          // El valor se refleja en "Inventario en stock" del desglose patrimonial.
          await adjustStock({ inventoryItemId: item.id, movementType: 'OPENING_STOCK', quantity: initQty, unitCost })
        }
      }
      return item
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setItemModal({ open: false })
    },
  })

  const adjustMut = useMutation({
    mutationFn: () => {
      const p = parseFloat(adjustCost.totalPrice)
      const q = parseFloat(adjustCost.totalQty)
      const unitCost = p > 0 && q > 0 ? p / q : undefined
      return adjustStock({ inventoryItemId: adjustModal.item!.id, ...adjust, unitCost })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); setAdjustModal({ open: false }) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteInventoryItem(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); setDeleteTarget(null); setDeleteError('') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteError(msg || 'No se pudo eliminar el insumo')
    },
  })

  const reconcileMut = useMutation({
    mutationFn: () => {
      const reconcileItems = items
        .filter((item) => reconcileRows[item.id] !== undefined && reconcileRows[item.id] !== '')
        .map((item) => ({
          inventoryItemId: item.id,
          physicalCount: parseFloat(reconcileRows[item.id]),
          cartId: locationCartId,
        }))
      return reconcileStock({ items: reconcileItems, notes: reconcileNotes || undefined })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      setReconcileModal(false)
      setReconcileRows({})
      setReconcileNotes('')
      setReconcileError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setReconcileError(msg || 'Error al guardar la toma de inventario.')
    },
  })

  const transferMut = useMutation({
    mutationFn: () => {
      const lines: TransferLine[] = Object.entries(transferLines)
        .filter(([, qty]) => parseFloat(qty) > 0)
        .map(([id, qty]) => ({ inventoryItemId: Number(id), quantity: parseFloat(qty) }))
      return transferToCart({ cartId: transferCartId!, items: lines, notes: transferNotes || undefined })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      setTransferModal(false)
      setTransferLines({})
      setTransferNotes('')
      setTransferError('')
    },
    onError: (err: any) => {
      setTransferError(err?.response?.data?.message ?? 'Error al transferir.')
    },
  })

  const bulkMut = useMutation({
    mutationFn: async () => {
      const validRows = bulkRows.filter(r => r.name.trim() && parseFloat(r.qty) > 0)
      if (validRows.length === 0) throw new Error('Agrega al menos un insumo con nombre y cantidad.')
      const today = new Date().toISOString().split('T')[0]
      for (const row of validRows) {
        const qty    = parseFloat(row.qty)
        const paid   = parseFloat(row.price)
        const unitCost = qty > 0 && paid > 0 ? paid / qty : undefined
        const item = await createInventoryItem({
          name: row.name.trim(), unitType: row.unitType,
          minimumStock: 0, averageCost: unitCost ?? 0,
        })
        // Stock inicial: establece CPP y cantidad sin afectar el balance de caja.
        await adjustStock({ inventoryItemId: item.id, movementType: 'OPENING_STOCK', quantity: qty, unitCost })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setBulkModal(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setBulkError(msg || (err as Error).message || 'Error al guardar.')
    },
  })

  const openEdit = (item: InventoryItem) => {
    setForm({
      name: item.name, unitType: item.unitType, minimumStock: item.minimumStock, averageCost: item.averageCost,
      requiresShiftCount: item.requiresShiftCount, containerSize: item.containerSize, containerLabel: item.containerLabel,
      discrepancyTolerancePct: item.discrepancyTolerancePct,
      shelfLifeDays: item.shelfLifeDays, restockLeadTimeDays: item.restockLeadTimeDays,
    })
    setCostCalc({ totalPrice: '', totalQty: '' })
    setShowInitialStock(false)
    setItemModal({ open: true, item })
  }

  const handleCostCalc = (field: 'totalPrice' | 'totalQty', value: string) => {
    const next = { ...costCalc, [field]: value }
    setCostCalc(next)
    const price = parseFloat(next.totalPrice)
    const qty = parseFloat(next.totalQty)
    if (price > 0 && qty > 0) {
      setForm(f => ({ ...f, averageCost: price / qty }))
    }
  }

  const calcUnitCost = (() => {
    const p = parseFloat(costCalc.totalPrice)
    const q = parseFloat(costCalc.totalQty)
    return p > 0 && q > 0 ? p / q : null
  })()

  const openTransfer = () => {
    setTransferCartId(activeCarts[0]?.id)
    setTransferLines({})
    setTransferNotes('')
    setTransferError('')
    setTransferModal(true)
  }

  // Items with central stock > 0, for transferring
  const { data: centralItems = [] } = useQuery({
    queryKey: ['inventory', undefined],
    queryFn: () => getInventory(undefined),
  })

  // Cart stock analysis
  const [analysisWindow, setAnalysisWindow] = useState(30)
  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['cart-analysis', locationCartId, analysisWindow],
    queryFn: () => getCartStockAnalysis(locationCartId!, analysisWindow),
    enabled: isCartView,
  })

  // Perishable analysis (bodega general)
  const [perishableWindow, setPerishableWindow] = useState(30)
  const { data: perishableData, isLoading: perishableLoading } = useQuery({
    queryKey: ['perishable-analysis', perishableWindow],
    queryFn: () => getPerishableAnalysis(perishableWindow),
    enabled: !isCartView,
  })

  const selectedCartName = activeCarts.find((c) => c.id === locationCartId)?.name

  if (isLoading) return <div className="text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Bodega / Inventario</h2>
          {isCartView && selectedCartName && (
            <p className="text-xs text-slate-400 mt-0.5">Stock en {selectedCartName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setReconcileRows({}); setReconcileNotes(''); setReconcileError(''); setReconcileModal(true) }}
            disabled={items.length === 0}
            className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <ClipboardList size={15} /> Toma de inventario
          </button>
          {!isCartView && (
            <>
              <button
                onClick={openTransfer}
                disabled={items.length === 0}
                className="flex items-center gap-1.5 border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                <ArrowRightLeft size={15} /> Transferir a PDV
              </button>
              <button
                onClick={() => { setForm({ name: '', unitType: 'PIECE', minimumStock: 0, averageCost: 0 }); setCostCalc({ totalPrice: '', totalQty: '' }); setShowInitialStock(false); setItemModal({ open: true }) }}
                disabled={activeCarts.length === 0}
                title={activeCarts.length === 0 ? 'Configura tus puntos de venta antes de agregar insumos' : undefined}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                <Plus size={16} /> Nuevo insumo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Location filter */}
      <div className="flex items-center gap-2">
        <Warehouse size={15} className="text-slate-400 shrink-0" />
        <select
          value={locationCartId ?? ''}
          onChange={(e) => setLocationCartId(e.target.value === '' ? undefined : Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">Bodega general</option>
          {activeCarts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Hint for cart view */}
      {isCartView && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-2 text-xs text-violet-700">
          Mostrando stock disponible en <strong>{selectedCartName}</strong>.
          El número en gris es el stock de bodega general para referencia.
        </div>
      )}

      {/* Items grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className={`bg-white rounded-xl border p-4 ${item.belowMinimum ? 'border-red-300' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
                <p className="text-xs text-slate-400">{UNIT_LABELS[item.unitType]}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {item.shelfLifeDays != null && (
                  <span className="text-xs bg-amber-100 text-amber-700 font-medium px-1.5 py-0.5 rounded-full">
                    {item.shelfLifeDays}d
                  </span>
                )}
                {item.belowMinimum && <AlertTriangle size={16} className="text-red-500" />}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">
              {item.currentStock} <span className="text-sm font-normal text-slate-400">{UNIT_LABELS[item.unitType]}</span>
            </div>
            {isCartView && item.centralStock !== item.currentStock && (
              <p className="text-xs text-slate-400 mb-1">Bodega: {item.centralStock} {UNIT_LABELS[item.unitType]}</p>
            )}
            <p className="text-xs text-slate-400 mb-3">
              Mínimo: {item.minimumStock > 0
                ? `${item.minimumStock} ${UNIT_LABELS[item.unitType]}`
                : <span className="text-violet-500 font-medium">Auto</span>}
            </p>
            <div className="flex gap-2">
              {!isCartView && (
                <button onClick={() => { setAdjust({ movementType: 'PURCHASE', quantity: 0, notes: '' }); setAdjustCost({ totalPrice: '', totalQty: '' }); setAdjustModal({ open: true, item }) }}
                  className="flex-1 flex items-center justify-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium py-1.5 rounded-lg transition-colors">
                  <TrendingUp size={13} /> Ajustar
                </button>
              )}
              <button onClick={() => setHistoryModal({ open: true, item })}
                className="flex items-center justify-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium py-1.5 px-3 rounded-lg transition-colors">
                <History size={13} />
              </button>
              {!isCartView && (
                <>
                  <button onClick={() => openEdit(item)}
                    className="flex items-center justify-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-600 font-medium py-1.5 px-3 rounded-lg transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => { setDeleteError(''); setDeleteTarget(item) }}
                    className="flex items-center justify-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-500 font-medium py-1.5 px-3 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full py-4">
            {!isCartView ? (
              activeCarts.length === 0 ? (
                /* ── Sin PDVs: bloquear bodega ────────────────────────────────── */
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col items-center gap-3 max-w-md mx-auto text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Warehouse size={20} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Configura tus puntos de venta primero</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Antes de cargar el inventario, agrega todos tus puntos de venta en el menú <strong>PDVs</strong>.
                      Así podrás organizar desde el inicio qué stock va a cada lugar.
                    </p>
                  </div>
                </div>
              ) : (
                /* ── PDVs OK, bodega vacía: mostrar carga inicial ─────────────── */
                <div className="space-y-3 max-w-lg mx-auto w-full">
                  {activeCarts.length > 1 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Warehouse size={15} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-blue-800">
                          Tienes {activeCarts.length} puntos de venta
                        </p>
                        <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                          Recomendamos hacer un conteo físico en <strong>cada PDV</strong>, sumar todo y cargarlo aquí en bodega central.
                          Una vez registrado, usa <strong>Transferir a PDV</strong> para distribuir el stock correctamente.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle size={16} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">La bodega está vacía</p>
                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                          ¿Ya tienes insumos en existencia? Carga todo tu inventario actual de una vez para que el sistema conozca tu capital desde el primer día y puedas hacer transferencias correctas a tus PDVs.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setBulkRows([{ id: Date.now(), name: '', unitType: 'PIECE', qty: '', price: '' }])
                          setBulkError('')
                          setBulkModal(true)
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                        <PackagePlus size={16} /> Cargar inventario inicial
                      </button>
                      <button
                        onClick={() => { setForm({ name: '', unitType: 'PIECE', minimumStock: 0, averageCost: 0 }); setCostCalc({ totalPrice: '', totalQty: '' }); setShowInitialStock(false); setItemModal({ open: true }) }}
                        className="border border-amber-400 text-amber-700 hover:bg-amber-100 text-sm font-medium py-2.5 px-4 rounded-xl transition-colors whitespace-nowrap">
                        + Uno a la vez
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <p className="text-slate-400 text-sm text-center">Sin stock transferido a este PDV.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Cart stock analysis ──────────────────────────────────────────────── */}
      {isCartView && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-violet-600" />
              <h3 className="font-semibold text-slate-800 text-sm">Análisis de stock — {selectedCartName}</h3>
            </div>
            <div className="flex gap-1">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setAnalysisWindow(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    analysisWindow === d
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {analysisLoading ? (
            <p className="text-slate-400 text-sm text-center py-6">Calculando...</p>
          ) : !analysis || analysis.items.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">
              Sin datos de consumo para este carrito en los últimos {analysisWindow} días.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100">
                    <th className="text-left px-5 py-2 font-medium">Insumo</th>
                    <th className="text-right px-4 py-2 font-medium">Stock actual</th>
                    <th className="text-right px-4 py-2 font-medium">Consumo/día</th>
                    <th className="text-right px-4 py-2 font-medium">Días estimados</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.items.map((item) => {
                    const unitLabel = item.unitType === 'PIECE' ? 'pza'
                      : item.unitType === 'GRAM' ? 'g' : 'ml'
                    const statusCfg = {
                      CRITICAL: { label: 'Crítico',   bg: 'bg-red-100',   text: 'text-red-700',   row: 'bg-red-50/40' },
                      LOW:      { label: 'Bajo',       bg: 'bg-amber-100', text: 'text-amber-700', row: 'bg-amber-50/40' },
                      OK:       { label: 'OK',         bg: 'bg-green-100', text: 'text-green-700', row: '' },
                      NO_DATA:  { label: 'Sin datos',  bg: 'bg-slate-100', text: 'text-slate-500', row: '' },
                    }[item.status] ?? { label: item.status, bg: 'bg-slate-100', text: 'text-slate-500', row: '' }

                    return (
                      <tr key={item.inventoryItemId} className={`border-b border-slate-100 last:border-0 ${statusCfg.row}`}>
                        <td className="px-5 py-3 font-medium text-slate-800">{item.name}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {item.currentCartStock.toFixed(2)} <span className="text-slate-400">{unitLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {item.avgDailyConsumption > 0
                            ? <>{item.avgDailyConsumption.toFixed(2)} <span className="text-slate-400">{unitLabel}</span></>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {item.estimatedDaysRemaining !== null
                            ? <span className={item.status === 'CRITICAL' ? 'text-red-600' : item.status === 'LOW' ? 'text-amber-600' : 'text-slate-700'}>
                                {item.estimatedDaysRemaining.toFixed(1)}d
                              </span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-2 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Basado en el promedio de consumo de los últimos <strong>{analysisWindow} días</strong>.
              Crítico &lt; 1 día · Bajo &lt; 3 días.
            </p>
          </div>
        </div>
      )}

      {/* ── Perishable analysis (bodega general only) ────────────────────────── */}
      {!isCartView && perishableData && perishableData.items.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="font-semibold text-slate-800 text-sm">Análisis de perecederos</h3>
            </div>
            <div className="flex gap-1">
              {[7, 14, 30].map((d) => (
                <button key={d} onClick={() => setPerishableWindow(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    perishableWindow === d ? 'bg-amber-500 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}>{d}d</button>
              ))}
            </div>
          </div>

          {perishableLoading ? (
            <p className="text-slate-400 text-sm text-center py-6">Calculando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100">
                    <th className="text-left px-5 py-2 font-medium">Insumo</th>
                    <th className="text-right px-3 py-2 font-medium">Stock</th>
                    <th className="text-right px-3 py-2 font-medium">Cons./día</th>
                    <th className="text-right px-3 py-2 font-medium">Días</th>
                    <th className="text-right px-3 py-2 font-medium">Mín. sug.</th>
                    <th className="text-right px-3 py-2 font-medium">Máx. sug.</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {perishableData.items.map((item: PerishableItemAnalysis) => {
                    const u = item.unitType === 'GRAM' ? 'g' : item.unitType === 'MILLILITER' ? 'ml' : 'pza'
                    const cfg = {
                      CRITICAL: { label: 'Crítico',     bg: 'bg-red-100',    text: 'text-red-700',    row: 'bg-red-50/40' },
                      LOW:      { label: 'Pedir pronto', bg: 'bg-amber-100',  text: 'text-amber-700',  row: 'bg-amber-50/40' },
                      EXCESS:   { label: 'Exceso',       bg: 'bg-purple-100', text: 'text-purple-700', row: 'bg-purple-50/20' },
                      OK:       { label: 'OK',           bg: 'bg-green-100',  text: 'text-green-700',  row: '' },
                      NO_DATA:  { label: 'Sin datos',    bg: 'bg-slate-100',  text: 'text-slate-500',  row: '' },
                    }[item.status] ?? { label: item.status, bg: 'bg-slate-100', text: 'text-slate-500', row: '' }
                    return (
                      <tr key={item.inventoryItemId} className={`border-b border-slate-100 last:border-0 ${cfg.row}`}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-400">vida útil: {item.shelfLifeDays}d · proveedor: {item.restockLeadTimeDays}d</p>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700 whitespace-nowrap">
                          {item.currentStock.toFixed(2)} <span className="text-slate-400">{u}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-500 whitespace-nowrap">
                          {item.avgDailyConsumption > 0
                            ? <>{item.avgDailyConsumption.toFixed(2)} <span className="text-slate-400">{u}</span></>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                          {item.estimatedDaysRemaining !== null
                            ? <span className={item.status === 'CRITICAL' ? 'text-red-600' : item.status === 'LOW' ? 'text-amber-600' : item.status === 'EXCESS' ? 'text-purple-600' : 'text-slate-700'}>
                                {item.estimatedDaysRemaining.toFixed(1)}d
                              </span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">
                          {item.suggestedMinStock !== null
                            ? <>{item.suggestedMinStock.toFixed(1)} <span className="text-slate-400">{u}</span></>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">
                          {item.suggestedMaxStock !== null
                            ? <>{item.suggestedMaxStock.toFixed(1)} <span className="text-slate-400">{u}</span></>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-2 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Consumo promedio de los últimos <strong>{perishableWindow} días</strong> (ventas + elaboraciones).
              Crítico = se acaba antes del proveedor · Exceso = riesgo de desperdicio.
            </p>
          </div>
        </div>
      )}

      {/* ── Transfer modal ───────────────────────────────────────────────────── */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-violet-600" />
                <h3 className="font-bold text-slate-800">Transferir a punto de venta</h3>
              </div>
              <button onClick={() => setTransferModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Destino */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Destino</label>
                <select value={transferCartId ?? ''}
                  onChange={(e) => setTransferCartId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                  {activeCarts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Items */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Insumos a transferir</label>
                <div className="space-y-2">
                  {centralItems.filter((i) => i.currentStock > 0).map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{item.name}</p>
                        <p className="text-xs text-slate-400">Disponible: {item.currentStock} {UNIT_LABELS[item.unitType]}</p>
                      </div>
                      <input
                        type="number" step="0.001" min="0"
                        max={item.currentStock}
                        value={transferLines[item.id] ?? ''}
                        onChange={(e) => setTransferLines((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="0"
                        className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-500"
                      />
                      <span className="text-xs text-slate-400 w-8">{UNIT_LABELS[item.unitType]}</span>
                    </div>
                  ))}
                  {centralItems.filter((i) => i.currentStock > 0).length === 0 && (
                    <p className="text-sm text-slate-400">Sin stock disponible en bodega general.</p>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Notas (opcional)</label>
                <input value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="ej. Surtido para turno matutino"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              {transferError && <p className="text-red-500 text-sm">{transferError}</p>}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setTransferModal(false)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => transferMut.mutate()}
                disabled={
                  transferMut.isPending ||
                  !transferCartId ||
                  Object.values(transferLines).every((v) => !v || parseFloat(v) <= 0)
                }
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {transferMut.isPending ? 'Transfiriendo...' : 'Confirmar transferencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item modal ───────────────────────────────────────────────────────── */}
      {itemModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">{itemModal.item ? 'Editar insumo' : 'Nuevo insumo'}</h3>
              <button onClick={() => setItemModal({ open: false })}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nombre</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Vaso chico, Queso rallado..." />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Unidad de medida</label>
                <select value={form.unitType}
                  onChange={(e) => { setForm({ ...form, unitType: e.target.value as UnitType }); setCostCalc({ totalPrice: '', totalQty: '' }) }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                  <option value="PIECE">Pieza (pza)</option>
                  <option value="GRAM">Gramo (g)</option>
                  <option value="MILLILITER">Mililitro (ml)</option>
                </select>
                {form.unitType === 'PIECE' && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
                    Para ingredientes que compras por peso o volumen (salsas, quesos, aceites…) usa <strong className="mx-0.5">Gramos</strong> o <strong className="mx-0.5">Mililitros</strong> — el gramaje varía entre presentaciones y el costo será más preciso.
                  </p>
                )}
              </div>

              {!itemModal.item ? (
                /* ── CREAR: stock inicial + costo unificado (A+B) ─────────────── */
                <div className="space-y-3">
                  {withinOnboardingPeriod && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showInitialStock}
                          onChange={(e) => {
                            setShowInitialStock(e.target.checked)
                            if (!e.target.checked) setCostCalc({ totalPrice: '', totalQty: '' })
                          }}
                          className="w-4 h-4 rounded accent-violet-600"
                        />
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">¿Ya tienes stock de este insumo?</span>
                      </label>

                      {showInitialStock && (
                        <>
                          <p className="text-xs text-slate-400">Indica cuánto tienes y cuánto pagaste para establecer el costo desde el primer día. No afecta el saldo de caja.</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-slate-500 block mb-1">
                                Cantidad ({UNIT_LABELS[form.unitType]})
                              </label>
                              <input type="number" min={0} step="0.001"
                                value={costCalc.totalQty}
                                onChange={(e) => handleCostCalc('totalQty', e.target.value)}
                                placeholder={form.unitType === 'GRAM' ? 'ej. 1200' : form.unitType === 'MILLILITER' ? 'ej. 1000' : 'ej. 1'}
                                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 block mb-1">Precio total pagado $</label>
                              <input type="number" min={0} step="0.01"
                                value={costCalc.totalPrice}
                                onChange={(e) => handleCostCalc('totalPrice', e.target.value)}
                                placeholder="ej. 160.00"
                                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                          </div>
                          {(() => {
                            const qty = parseFloat(costCalc.totalQty)
                            const paid = parseFloat(costCalc.totalPrice)
                            if (qty > 0 && calcUnitCost !== null) {
                              return (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                                    <span className="text-xs text-violet-700">CPP inicial (costo/{UNIT_LABELS[form.unitType]})</span>
                                    <span className="text-sm font-bold text-violet-700">${calcUnitCost.toFixed(4)}</span>
                                  </div>
                                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                    <span className="text-xs text-blue-700">Valor en inventario (no afecta caja)</span>
                                    <span className="text-sm font-bold text-blue-700">${paid.toFixed(2)}</span>
                                  </div>
                                </div>
                              )
                            }
                            if (qty > 0) {
                              return (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  Ingresa el precio pagado para calcular el costo unitario automáticamente.
                                </p>
                              )
                            }
                            return null
                          })()}
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                    <span className="text-lg shrink-0">🧠</span>
                    <div>
                      <p className="text-sm font-semibold text-violet-800">El sistema calculará el mínimo automáticamente</p>
                      <p className="text-xs text-violet-700 mt-0.5 leading-relaxed">
                        Después de 30 días de ventas y elaboraciones, el sistema analizará el consumo real de este insumo
                        y calculará el stock mínimo óptimo — sin que tengas que hacer nada.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── EDITAR: calculadora de costo + override mínimo ───────────── */
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Costo de compra</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Precio total pagado $</label>
                      <input type="number" min={0} step="0.01"
                        value={costCalc.totalPrice}
                        onChange={(e) => handleCostCalc('totalPrice', e.target.value)}
                        placeholder="ej. 160.00"
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">
                        Cantidad comprada ({UNIT_LABELS[form.unitType]})
                      </label>
                      <input type="number" min={0} step="1"
                        value={costCalc.totalQty}
                        onChange={(e) => handleCostCalc('totalQty', e.target.value)}
                        placeholder={form.unitType === 'GRAM' ? 'ej. 1200' : form.unitType === 'MILLILITER' ? 'ej. 1000' : 'ej. 1'}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                    </div>
                  </div>
                  {calcUnitCost !== null ? (
                    <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-violet-700">Costo por {UNIT_LABELS[form.unitType]}</span>
                      <span className="text-sm font-bold text-violet-700">${calcUnitCost.toFixed(4)}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Costo actual: <strong>${form.averageCost.toFixed(4)}/{UNIT_LABELS[form.unitType]}</strong>. Rellena los campos para recalcular.
                    </p>
                  )}
                </div>
              )}

              {itemModal.item && (
                /* ── EDITAR: override manual ──────────────────────────────────── */
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Override de mínimo ({UNIT_LABELS[form.unitType]})
                  </label>
                  <input type="number" min={0} value={form.minimumStock}
                    onChange={(e) => setForm({ ...form, minimumStock: parseFloat(e.target.value) })}
                    placeholder="0"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                  <p className="text-xs text-slate-400 mt-1">
                    El sistema lo calcula automáticamente. Solo ajusta si sabes algo que el sistema no — por ejemplo, una temporada especial.
                  </p>
                </div>
              )}
            </div>

            {/* ── Presentación / Envase ─────────────────────────────────────── */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-0.5">Presentación de compra</p>
                <p className="text-xs text-slate-400 mb-2">
                  El sistema usa esto para sugerir resurtidos en envases completos en lugar de gramos/piezas sueltas.
                  Ej: mayonesa en frascos de 3,400 g.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">
                    Tamaño del envase ({form.unitType === 'PIECE' ? 'pzas' : form.unitType === 'GRAM' ? 'g' : 'ml'})
                  </label>
                  <input type="number" min={0} step="1"
                    value={form.containerSize ?? ''}
                    onChange={(e) => setForm({ ...form, containerSize: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="ej. 3400"
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Nombre de la presentación</label>
                  <input type="text"
                    value={form.containerLabel ?? ''}
                    onChange={(e) => setForm({ ...form, containerLabel: e.target.value || undefined })}
                    placeholder="frasco, lata, caja, bolsa..."
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                </div>
              </div>
              {form.containerSize && form.containerLabel && (
                <p className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
                  Los sugeridos de resurtido se calcularán en <strong>{form.containerLabel} de {form.containerSize} {form.unitType === 'PIECE' ? 'pzas' : form.unitType === 'GRAM' ? 'g' : 'ml'}</strong>.
                </p>
              )}
            </div>

            {/* ── Perecedero ────────────────────────────────────────────────── */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.shelfLifeDays !== undefined}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setForm({ ...form, shelfLifeDays: 1, restockLeadTimeDays: 1 })
                    } else {
                      setForm({ ...form, shelfLifeDays: undefined, restockLeadTimeDays: undefined })
                    }
                  }}
                  className="w-4 h-4 rounded accent-violet-600"
                />
                <span className="text-sm font-semibold text-slate-700">Perecedero</span>
              </label>

              {form.shelfLifeDays !== undefined && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Vida útil (días)</label>
                      <input type="number" min={1} step={1}
                        value={form.shelfLifeDays}
                        onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value ? parseInt(e.target.value) : 1 })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Días proveedor</label>
                      <p className="text-xs text-slate-400 mb-1">¿Cuántos días tarda tu proveedor en surtir este insumo?</p>
                      <input type="number" min={1} step={1}
                        value={form.restockLeadTimeDays ?? 1}
                        onChange={(e) => setForm({ ...form, restockLeadTimeDays: e.target.value ? parseInt(e.target.value) : 1 })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Con estos datos el sistema calculará tu mínimo y máximo sugerido usando el consumo promedio de los últimos 30 días.
                  </p>
                </>
              )}
            </div>

            {/* ── Conteo de turno ───────────────────────────────────────────── */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.requiresShiftCount}
                  onChange={(e) => setForm({ ...form, requiresShiftCount: e.target.checked })}
                  className="w-4 h-4 rounded accent-violet-600" />
                <span className="text-sm font-medium text-slate-700">Requiere conteo físico en turno</span>
              </label>
              {form.requiresShiftCount && (
                <div className="pl-6">
                  <label className="text-xs text-slate-500 block mb-1">Tolerancia de discrepancia (%)</label>
                  <input type="number" min={0} max={100} step="0.1"
                    value={form.discrepancyTolerancePct ?? ''}
                    onChange={(e) => setForm({ ...form, discrepancyTolerancePct: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="ej. 5 = tolerar hasta 5% de diferencia"
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                  <p className="text-xs text-slate-400 mt-1">Estrategia ALERTA. Vacío = cualquier diferencia genera alerta.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setItemModal({ open: false })}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={() => saveMut.mutate()} disabled={!form.name || saveMut.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {saveMut.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Adjust modal ─────────────────────────────────────────────────────── */}
      {adjustModal.open && adjustModal.item && (() => {
        const unit = UNIT_LABELS[adjustModal.item.unitType]
        const isPurchase = adjust.movementType === 'PURCHASE' || adjust.movementType === 'OPENING_STOCK'
        const adjP = parseFloat(adjustCost.totalPrice)
        const adjQ = parseFloat(adjustCost.totalQty)
        const adjUnitCost = adjP > 0 && adjQ > 0 ? adjP / adjQ : null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Ajustar — {adjustModal.item.name}</h3>
                <button onClick={() => setAdjustModal({ open: false })}><X size={20} className="text-slate-400" /></button>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Tipo de movimiento</label>
                <select value={adjust.movementType}
                  onChange={(e) => { setAdjust({ ...adjust, movementType: e.target.value as MovementType }); setAdjustCost({ totalPrice: '', totalQty: '' }) }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                  <option value="PURCHASE">Compra / Entrada</option>
                  <option value="OPENING_STOCK">Stock inicial</option>
                  <option value="MANUAL_ADJUSTMENT">Ajuste manual</option>
                  <option value="WASTE">Merma</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Cantidad ({unit}){!isPurchase && ' — positivo = entrada, negativo = salida'}
                </label>
                <input type="number" step="0.001" value={adjust.quantity}
                  onChange={(e) => setAdjust({ ...adjust, quantity: parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
              </div>

              {/* Calculadora CPP — solo en entradas de compra */}
              {isPurchase && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Costo de esta compra</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Precio total pagado $</label>
                      <input type="number" min={0} step="0.01"
                        value={adjustCost.totalPrice}
                        onChange={(e) => setAdjustCost(c => ({ ...c, totalPrice: e.target.value }))}
                        placeholder="ej. 160.00"
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Cantidad comprada ({unit})</label>
                      <input type="number" min={0} step="1"
                        value={adjustCost.totalQty}
                        onChange={(e) => setAdjustCost(c => ({ ...c, totalQty: e.target.value }))}
                        placeholder="ej. 1200"
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500" />
                    </div>
                  </div>
                  {adjUnitCost !== null ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                        <span className="text-xs text-violet-700">Costo por {unit} (esta compra)</span>
                        <span className="text-sm font-bold text-violet-700">${adjUnitCost.toFixed(4)}</span>
                      </div>
                      <p className="text-xs text-slate-400 px-1">
                        El costo promedio de <strong>{adjustModal.item.name}</strong> se recalculará automáticamente al confirmar.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Costo actual: <strong>${adjustModal.item.averageCost.toFixed(4)}/{unit}</strong>.
                      Llena los campos para actualizar el costo promedio con CPP.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Notas</label>
                <input value={adjust.notes} onChange={(e) => setAdjust({ ...adjust, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Opcional" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setAdjustModal({ open: false })}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
                <button onClick={() => adjustMut.mutate()} disabled={adjustMut.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                  {adjustMut.isPending ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Delete confirmation ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Eliminar insumo</h3>
                <p className="text-sm text-slate-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-4">
              ¿Eliminar <span className="font-semibold">"{deleteTarget.name}"</span>?
            </p>
            {deleteError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteError('') }}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={() => deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {deleteMut.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reconcile (toma de inventario) modal ─────────────────────────────── */}
      {reconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-slate-600" />
                <div>
                  <h3 className="font-bold text-slate-800">Toma de inventario</h3>
                  <p className="text-xs text-slate-400">
                    {isCartView ? `Stock en ${selectedCartName}` : 'Bodega general'}
                  </p>
                </div>
              </div>
              <button onClick={() => setReconcileModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>

            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-800">
                Ingresa el conteo físico real de cada insumo. Los campos vacíos no se modifican.
                Se registrará un ajuste manual por cada diferencia encontrada.
              </p>
            </div>

            <div className="overflow-y-auto flex-1">
              {items.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Sin insumos para mostrar.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100 sticky top-0 bg-white">
                      <th className="text-left px-5 py-2 font-medium">Insumo</th>
                      <th className="text-right px-4 py-2 font-medium">Sistema</th>
                      <th className="text-right px-4 py-2 font-medium w-32">Conteo real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const physVal = reconcileRows[item.id]
                      const physical = physVal !== undefined && physVal !== '' ? parseFloat(physVal) : null
                      const diff = physical !== null ? physical - item.currentStock : null
                      return (
                        <tr key={item.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-800">{item.name}</p>
                            <p className="text-xs text-slate-400">{UNIT_LABELS[item.unitType]}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {item.currentStock} <span className="text-slate-400 text-xs">{UNIT_LABELS[item.unitType]}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-end gap-1">
                              <input
                                type="number" min={0} step="0.001"
                                value={physVal ?? ''}
                                onChange={(e) => setReconcileRows((r) => ({ ...r, [item.id]: e.target.value }))}
                                placeholder={String(item.currentStock)}
                                className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-500"
                              />
                              {diff !== null && diff !== 0 && (
                                <span className={`text-xs font-medium ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Notas (opcional)</label>
                <input
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  placeholder="ej. Conteo mensual de cierre"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              {reconcileError && (
                <p className="text-red-500 text-sm">{reconcileError}</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setReconcileModal(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                  Cancelar
                </button>
                <button
                  onClick={() => reconcileMut.mutate()}
                  disabled={
                    reconcileMut.isPending ||
                    Object.values(reconcileRows).every((v) => v === undefined || v === '')
                  }
                  className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                  {reconcileMut.isPending ? 'Guardando...' : 'Guardar toma de inventario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk initial load modal ──────────────────────────────────────────── */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PackagePlus size={18} className="text-amber-600" />
                <div>
                  <h3 className="font-bold text-slate-800">Carga inicial de inventario</h3>
                  <p className="text-xs text-slate-400">Agrega todos tus insumos y sus costos de una sola vez</p>
                </div>
              </div>
              <button onClick={() => setBulkModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>

            {/* Info tip */}
            <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-800">
                Usá este flujo para inventario que <strong>ya tenías antes de adoptar el ERP</strong>.
                El precio establece el costo promedio pero <strong>no descuenta de tu caja</strong> —
                el valor aparece como "Inventario en stock" en el desglose patrimonial.
              </p>
            </div>

            {/* Rows */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {bulkRows.map((row, idx) => (
                <div key={row.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 w-5 shrink-0">#{idx + 1}</span>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => setBulkRows(r => r.map(x => x.id === row.id ? { ...x, name: e.target.value } : x))}
                      placeholder="Nombre del insumo"
                      className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                    />
                    <button
                      onClick={() => setBulkRows(r => r.filter(x => x.id !== row.id))}
                      className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pl-7">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Unidad</label>
                      <select
                        value={row.unitType}
                        onChange={(e) => setBulkRows(r => r.map(x => x.id === row.id ? { ...x, unitType: e.target.value as UnitType } : x))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-violet-500">
                        <option value="PIECE">pza</option>
                        <option value="GRAM">g</option>
                        <option value="MILLILITER">ml</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Cantidad</label>
                      <input
                        type="number" min={0} step="0.001"
                        value={row.qty}
                        onChange={(e) => setBulkRows(r => r.map(x => x.id === row.id ? { ...x, qty: e.target.value } : x))}
                        placeholder="0"
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Precio total $</label>
                      <input
                        type="number" min={0} step="0.01"
                        value={row.price}
                        onChange={(e) => setBulkRows(r => r.map(x => x.id === row.id ? { ...x, price: e.target.value } : x))}
                        placeholder="0.00"
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                  {parseFloat(row.qty) > 0 && parseFloat(row.price) > 0 && (
                    <p className="text-xs text-violet-600 pl-7">
                      CPP: ${(parseFloat(row.price) / parseFloat(row.qty)).toFixed(4)}/{UNIT_LABELS[row.unitType]}
                      · Gasto: ${parseFloat(row.price).toFixed(2)}
                    </p>
                  )}
                </div>
              ))}
              <button
                onClick={() => setBulkRows(r => [...r, { id: Date.now(), name: '', unitType: 'PIECE', qty: '', price: '' }])}
                className="w-full border-2 border-dashed border-slate-300 hover:border-violet-400 text-slate-400 hover:text-violet-600 text-sm py-2.5 rounded-xl transition-colors">
                + Agregar insumo
              </button>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 space-y-3">
              {(() => {
                const total = bulkRows.reduce((s, r) => s + (parseFloat(r.price) || 0), 0)
                const count = bulkRows.filter(r => r.name.trim() && parseFloat(r.qty) > 0).length
                if (count === 0) return null
                return (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                    <span className="text-sm text-emerald-700">{count} insumo{count !== 1 ? 's' : ''} · Gasto total a registrar</span>
                    <span className="text-base font-bold text-emerald-700">${total.toFixed(2)}</span>
                  </div>
                )
              })()}
              {bulkError && <p className="text-red-500 text-sm">{bulkError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setBulkModal(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                  Cancelar
                </button>
                <button
                  onClick={() => bulkMut.mutate()}
                  disabled={bulkMut.isPending || bulkRows.filter(r => r.name.trim() && parseFloat(r.qty) > 0).length === 0}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                  {bulkMut.isPending ? 'Guardando...' : 'Guardar inventario inicial'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── History modal ────────────────────────────────────────────────────── */}
      {historyModal.open && historyModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Historial — {historyModal.item.name}</h3>
              <button onClick={() => setHistoryModal({ open: false })}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-100 text-sm">
                  <div>
                    <span className={`font-medium ${m.quantity >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {m.quantity >= 0 ? '+' : ''}{m.quantity}
                    </span>
                    <span className="text-slate-500 ml-2">{MOVE_LABELS[m.movementType as MovementType] || m.movementType}</span>
                    {m.notes && <p className="text-xs text-slate-400 mt-0.5">{m.notes}</p>}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(m.createdAt).toLocaleString('es-MX')}
                  </span>
                </div>
              ))}
              {movements.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-8">Sin movimientos registrados.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
