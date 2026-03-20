import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInventory, createInventoryItem, updateInventoryItem, adjustStock, getMovements, deleteInventoryItem
} from '../api/inventory'
import type { InventoryItem, InventoryItemRequest, MovementType, UnitType } from '../types'
import { Plus, Pencil, TrendingUp, AlertTriangle, X, History, Trash2 } from 'lucide-react'

const UNIT_LABELS: Record<UnitType, string> = {
  PIECE: 'pza', GRAM: 'g', MILLILITER: 'ml',
}
const MOVE_LABELS: Record<MovementType, string> = {
  PURCHASE: 'Compra', TRANSFER_TO_CART: 'Transferencia',
  SALE_DEDUCTION: 'Venta', MANUAL_ADJUSTMENT: 'Ajuste',
  WASTE: 'Merma', RETURN: 'Devolución', OPENING_STOCK: 'Stock inicial',
}

export default function Inventory() {
  const qc = useQueryClient()
  const { data: items = [], isLoading } = useQuery({ queryKey: ['inventory'], queryFn: getInventory })

  const [itemModal, setItemModal] = useState<{ open: boolean; item?: InventoryItem }>({ open: false })
  const [adjustModal, setAdjustModal] = useState<{ open: boolean; item?: InventoryItem }>({ open: false })
  const [historyModal, setHistoryModal] = useState<{ open: boolean; item?: InventoryItem }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const [form, setForm] = useState<InventoryItemRequest>({
    name: '', unitType: 'PIECE', minimumStock: 0, averageCost: 0,
  })
  const [adjust, setAdjust] = useState({ movementType: 'PURCHASE' as MovementType, quantity: 0, notes: '' })

  const { data: movements = [] } = useQuery({
    queryKey: ['movements', historyModal.item?.id],
    queryFn: () => getMovements(historyModal.item!.id),
    enabled: !!historyModal.item,
  })

  const saveMut = useMutation({
    mutationFn: () => itemModal.item
      ? updateInventoryItem(itemModal.item.id, form)
      : createInventoryItem(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); setItemModal({ open: false }) },
  })

  const adjustMut = useMutation({
    mutationFn: () => adjustStock({ inventoryItemId: adjustModal.item!.id, ...adjust }),
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

  const openEdit = (item: InventoryItem) => {
    setForm({ name: item.name, unitType: item.unitType, minimumStock: item.minimumStock, averageCost: item.averageCost })
    setItemModal({ open: true, item })
  }

  if (isLoading) return <div className="text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Inventario</h2>
        <button
          onClick={() => { setForm({ name: '', unitType: 'PIECE', minimumStock: 0, averageCost: 0 }); setItemModal({ open: true }) }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo insumo
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className={`bg-white rounded-xl border p-4 ${item.belowMinimum ? 'border-red-300' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
                <p className="text-xs text-slate-400">{UNIT_LABELS[item.unitType]}</p>
              </div>
              {item.belowMinimum && <AlertTriangle size={16} className="text-red-500 shrink-0" />}
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">
              {item.currentStock} <span className="text-sm font-normal text-slate-400">{UNIT_LABELS[item.unitType]}</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">Mínimo: {item.minimumStock} {UNIT_LABELS[item.unitType]}</p>
            <div className="flex gap-2">
              <button onClick={() => { setAdjust({ movementType: 'PURCHASE', quantity: 0, notes: '' }); setAdjustModal({ open: true, item }) }}
                className="flex-1 flex items-center justify-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium py-1.5 rounded-lg transition-colors">
                <TrendingUp size={13} /> Ajustar
              </button>
              <button onClick={() => setHistoryModal({ open: true, item })}
                className="flex items-center justify-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium py-1.5 px-3 rounded-lg transition-colors">
                <History size={13} />
              </button>
              <button onClick={() => openEdit(item)}
                className="flex items-center justify-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-600 font-medium py-1.5 px-3 rounded-lg transition-colors">
                <Pencil size={13} />
              </button>
              <button onClick={() => { setDeleteError(''); setDeleteTarget(item) }}
                className="flex items-center justify-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-500 font-medium py-1.5 px-3 rounded-lg transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-slate-400 text-sm col-span-full py-8 text-center">
            No hay insumos registrados.
          </p>
        )}
      </div>

      {/* Item Modal */}
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
                <select value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value as UnitType })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                  <option value="PIECE">Pieza</option>
                  <option value="GRAM">Gramo</option>
                  <option value="MILLILITER">Mililitro</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Stock mínimo</label>
                  <input type="number" value={form.minimumStock}
                    onChange={(e) => setForm({ ...form, minimumStock: parseFloat(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Costo unitario $</label>
                  <input type="number" step="0.0001" value={form.averageCost}
                    onChange={(e) => setForm({ ...form, averageCost: parseFloat(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setItemModal({ open: false })}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={() => saveMut.mutate()} disabled={!form.name || saveMut.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {saveMut.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustModal.open && adjustModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">Ajustar stock — {adjustModal.item.name}</h3>
              <button onClick={() => setAdjustModal({ open: false })}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Tipo de movimiento</label>
                <select value={adjust.movementType}
                  onChange={(e) => setAdjust({ ...adjust, movementType: e.target.value as MovementType })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                  <option value="PURCHASE">Compra / Entrada</option>
                  <option value="OPENING_STOCK">Stock inicial</option>
                  <option value="MANUAL_ADJUSTMENT">Ajuste manual</option>
                  <option value="WASTE">Merma</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Cantidad ({UNIT_LABELS[adjustModal.item.unitType]}) — positivo = entrada, negativo = salida
                </label>
                <input type="number" step="0.001" value={adjust.quantity}
                  onChange={(e) => setAdjust({ ...adjust, quantity: parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Notas</label>
                <input value={adjust.notes} onChange={(e) => setAdjust({ ...adjust, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Opcional" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setAdjustModal({ open: false })}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={() => adjustMut.mutate()} disabled={adjustMut.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {adjustMut.isPending ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar eliminación ─────────────────────────────────────────────── */}
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
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={() => deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {deleteMut.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
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
