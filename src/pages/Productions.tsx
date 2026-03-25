import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listProductions, createProduction, confirmProduction, deleteProduction,
} from '../api/productions'
import { getInventory } from '../api/inventory'
import type {
  ProductionResponse, ProductionRequest, ProductionIngredientRequest,
} from '../types'
import {
  ChefHat, Plus, Trash2, CheckCircle2, X, FlaskConical, Package,
} from 'lucide-react'

const fmt = (n?: number) =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const fmtQty = (n: number, unit: string) => {
  const u = unit === 'GRAM' ? 'g' : unit === 'MILLILITER' ? 'ml' : 'pza'
  return `${n.toLocaleString('es-MX')} ${u}`
}

const today = () => new Date().toISOString().slice(0, 10)

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Borrador',   color: 'bg-slate-100 text-slate-600' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
}

const emptyForm = (): ProductionRequest => ({
  outputItemId: 0,
  yieldQuantity: 0,
  notes: '',
  producedAt: today(),
  ingredients: [],
})

export default function Productions() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<ProductionResponse | null>(null)
  const [form, setForm] = useState<ProductionRequest>(emptyForm())
  const [error, setError] = useState('')

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['productions'],
    queryFn: listProductions,
  })

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => getInventory(),
  })

  const createMut = useMutation({
    mutationFn: createProduction,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['productions'] }); closeForm() },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Error al crear producción'),
  })

  const confirmMut = useMutation({
    mutationFn: confirmProduction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productions'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      setSelected(null)
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Error al confirmar'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteProduction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productions'] })
      setSelected(null)
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Error al eliminar'),
  })

  function closeForm() {
    setShowForm(false)
    setForm(emptyForm())
    setError('')
  }

  function addIngredient() {
    setForm(f => ({
      ...f,
      ingredients: [...f.ingredients, { inventoryItemId: 0, quantity: 0 }],
    }))
  }

  function removeIngredient(idx: number) {
    setForm(f => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== idx),
    }))
  }

  function setIngredient(idx: number, patch: Partial<ProductionIngredientRequest>) {
    setForm(f => ({
      ...f,
      ingredients: f.ingredients.map((ing, i) => i === idx ? { ...ing, ...patch } : ing),
    }))
  }

  function handleSubmit() {
    setError('')
    if (!form.outputItemId) { setError('Selecciona el artículo de salida'); return }
    if (!form.yieldQuantity || form.yieldQuantity <= 0) { setError('Cantidad producida inválida'); return }
    if (form.ingredients.length === 0) { setError('Agrega al menos un ingrediente'); return }
    for (const ing of form.ingredients) {
      if (!ing.inventoryItemId) { setError('Selecciona todos los ingredientes'); return }
      if (!ing.quantity || ing.quantity <= 0) { setError('Cantidades de ingredientes inválidas'); return }
    }
    createMut.mutate(form)
  }

  const activeItems = inventoryItems.filter(i => i.active)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChefHat className="text-amber-600" size={22} />
          <h1 className="text-lg font-bold text-slate-800">Producción</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
        >
          <Plus size={16} /> Nueva
        </button>
      </div>

      {/* Error banner */}
      {error && !showForm && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-slate-400 text-sm text-center py-8">Cargando...</p>
      ) : productions.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FlaskConical size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin lotes de producción</p>
        </div>
      ) : (
        <div className="space-y-2">
          {productions.map(p => {
            const st = STATUS_LABELS[p.status]
            return (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setError('') }}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{p.outputItemName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {fmtQty(p.yieldQuantity, p.outputItemUnit)} · {p.ingredients.length} ingredientes
                      {p.producedAt && <> · {p.producedAt}</>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    {p.totalCost != null && (
                      <span className="text-xs text-slate-500">{fmt(p.totalCost)}</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* New Production Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Nuevo lote de producción</h2>
              <button onClick={closeForm}><X size={20} /></button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Output item */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Artículo producido</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.outputItemId || ''}
                  onChange={e => setForm(f => ({ ...f, outputItemId: Number(e.target.value) }))}
                >
                  <option value="">Seleccionar...</option>
                  {activeItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unitType})</option>
                  ))}
                </select>
              </div>

              {/* Yield quantity */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad producida</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.yieldQuantity || ''}
                  onChange={e => setForm(f => ({ ...f, yieldQuantity: Number(e.target.value) }))}
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de producción</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.producedAt ?? ''}
                  onChange={e => setForm(f => ({ ...f, producedAt: e.target.value }))}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">Ingredientes</label>
                  <button
                    onClick={addIngredient}
                    className="text-xs text-amber-600 font-medium flex items-center gap-1 hover:underline"
                  >
                    <Plus size={13} /> Agregar
                  </button>
                </div>
                {form.ingredients.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">
                    Sin ingredientes
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          value={ing.inventoryItemId || ''}
                          onChange={e => setIngredient(idx, { inventoryItemId: Number(e.target.value) })}
                        >
                          <option value="">Insumo...</option>
                          {activeItems.map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="Qty"
                          className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          value={ing.quantity || ''}
                          onChange={e => setIngredient(idx, { quantity: Number(e.target.value) })}
                        />
                        <button
                          onClick={() => removeIngredient(idx)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={createMut.isPending}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm"
              >
                {createMut.isPending ? 'Guardando...' : 'Guardar borrador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Confirm Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 truncate">{selected.outputItemName}</h2>
              <button onClick={() => { setSelected(null); setError('') }}><X size={20} /></button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_LABELS[selected.status].color}`}>
                  {STATUS_LABELS[selected.status].label}
                </span>
                {selected.producedAt && (
                  <span className="text-xs text-slate-500">Fecha: {selected.producedAt}</span>
                )}
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Cantidad</p>
                  <p className="font-semibold text-slate-800">
                    {fmtQty(selected.yieldQuantity, selected.outputItemUnit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Costo total</p>
                  <p className="font-semibold text-slate-800">{fmt(selected.totalCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Costo por unidad</p>
                  <p className="font-semibold text-slate-800">{fmt(selected.costPerUnit)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Creado por</p>
                  <p className="font-semibold text-slate-800">{selected.createdByName ?? '—'}</p>
                </div>
              </div>

              {/* Notes */}
              {selected.notes && (
                <p className="text-sm text-slate-600 italic">"{selected.notes}"</p>
              )}

              {/* Ingredients */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <Package size={13} /> Ingredientes
                </p>
                <div className="space-y-1.5">
                  {selected.ingredients.map(ing => (
                    <div
                      key={ing.id}
                      className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2"
                    >
                      <span className="text-slate-700">{ing.inventoryItemName}</span>
                      <div className="text-right">
                        <p className="text-slate-600">{fmtQty(ing.quantity, ing.unitType)}</p>
                        {ing.unitCostSnapshot != null && (
                          <p className="text-xs text-slate-400">{fmt(ing.totalCost)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {selected.status === 'DRAFT' && (
                  <>
                    <button
                      onClick={() => confirmMut.mutate(selected.id)}
                      disabled={confirmMut.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm"
                    >
                      <CheckCircle2 size={16} />
                      {confirmMut.isPending ? 'Confirmando...' : 'Confirmar producción'}
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(selected.id)}
                      disabled={deleteMut.isPending}
                      className="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 px-3 rounded-xl text-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                {selected.status === 'CONFIRMED' && (
                  <p className="text-sm text-emerald-600 text-center w-full py-2 font-medium">
                    Producción confirmada — inventario actualizado
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}