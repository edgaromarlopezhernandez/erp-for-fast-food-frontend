import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listProductions, createProduction, confirmProduction, deleteProduction,
} from '../api/productions'
import {
  listProductionTemplates, createProductionTemplate, updateProductionTemplate, archiveProductionTemplate,
} from '../api/productionTemplates'
import { getInventory } from '../api/inventory'
import type {
  ProductionResponse, ProductionRequest, ProductionIngredientRequest,
  ProductionStockWarning,
  ProductionTemplateResponse, ProductionTemplateRequest, ProductionTemplateIngredientRequest,
} from '../types'
import {
  ChefHat, Plus, Trash2, CheckCircle2, X, FlaskConical, Package,
  BookOpen, Pencil, Archive, ChevronDown, ChevronUp,
} from 'lucide-react'

const fmt = (n?: number) =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const fmtQty = (n: number, unit: string) => {
  const u = unit === 'GRAM' ? 'g' : unit === 'MILLILITER' ? 'ml' : 'pza'
  return `${n.toLocaleString('es-MX')} ${u}`
}

const formatDateLocal = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const today = () => formatDateLocal(new Date())

const maxProductionDate = () => {
  const d = new Date()
  d.setDate(d.getDate() + 6)
  return formatDateLocal(d)
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Borrador',   color: 'bg-slate-100 text-slate-600' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Cancelada',  color: 'bg-red-100 text-red-700' },
}

const emptyForm = (): ProductionRequest => ({
  outputItemId: 0,
  yieldQuantity: 0,
  notes: '',
  producedAt: today(),
  ingredients: [],
})

const emptyTemplateForm = (): ProductionTemplateRequest => ({
  name: '',
  outputItemId: 0,
  baseYield: 0,
  baseYieldUnit: 'porciones',
  preparationInstructions: '',
  ingredients: [],
})

type View = 'lotes' | 'plantillas'

export default function Productions() {
  const qc = useQueryClient()

  // ── view ──────────────────────────────────────────────────────────────────
  const [view, setView] = useState<View>('plantillas')

  // ── lotes state ───────────────────────────────────────────────────────────
  const [showForm, setShowForm]       = useState(false)
  const [selected, setSelected]       = useState<ProductionResponse | null>(null)
  const [form, setForm]               = useState<ProductionRequest>(emptyForm())
  const [error, setError]             = useState('')
  const [activeTemplate, setActiveTemplate] = useState<ProductionTemplateResponse | null>(null)
  const [stockAlert, setStockAlert]   = useState<{ folio: string; items: ProductionStockWarning[] } | null>(null)
  const [pendingAction, setPendingAction] = useState<'confirm' | 'delete' | null>(null)

  // ── plantillas state ──────────────────────────────────────────────────────
  const [showTemplateForm, setShowTemplateForm]   = useState(false)
  const [editingTemplate, setEditingTemplate]     = useState<ProductionTemplateResponse | null>(null)
  const [selectedTemplate, setSelectedTemplate]   = useState<ProductionTemplateResponse | null>(null)
  const [templateForm, setTemplateForm]           = useState<ProductionTemplateRequest>(emptyTemplateForm())
  const [templateError, setTemplateError]         = useState('')
  const [showInstructions, setShowInstructions]   = useState(false)

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['productions'],
    queryFn: listProductions,
  })

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['production-templates'],
    queryFn: listProductionTemplates,
  })

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => getInventory(),
  })

  const activeItems   = inventoryItems.filter(i => i.active)
  const producedItems = activeItems.filter(i => i.itemType === 'PRODUCED')
  const purchasedItems = activeItems.filter(i => i.itemType === 'PURCHASED')

  const unitLabel = (unitType: string) =>
    unitType === 'GRAM' ? 'g' : unitType === 'MILLILITER' ? 'ml' : 'pza'

  // ── lote mutations ────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: createProduction,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['productions'] })
      if (data.autoPurchaseOrderFolio && data.insufficientIngredients?.length) {
        qc.invalidateQueries({ queryKey: ['purchase-orders'] })
        setStockAlert({ folio: data.autoPurchaseOrderFolio, items: data.insufficientIngredients })
      }
      closeForm()
    },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['productions'] }); setSelected(null) },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Error al eliminar'),
  })

  // ── template mutations ────────────────────────────────────────────────────
  const createTemplateMut = useMutation({
    mutationFn: createProductionTemplate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-templates'] }); closeTemplateForm() },
    onError: (e: any) => setTemplateError(e.response?.data?.message ?? 'Error al guardar plantilla'),
  })

  const updateTemplateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductionTemplateRequest }) =>
      updateProductionTemplate(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-templates'] }); closeTemplateForm() },
    onError: (e: any) => setTemplateError(e.response?.data?.message ?? 'Error al actualizar plantilla'),
  })

  const archiveTemplateMut = useMutation({
    mutationFn: archiveProductionTemplate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-templates'] }); setSelectedTemplate(null) },
    onError: (e: any) => setTemplateError(e.response?.data?.message ?? 'Error al archivar'),
  })

  // ── lote helpers ──────────────────────────────────────────────────────────
  function closeForm() {
    setShowForm(false)
    setForm(emptyForm())
    setError('')
    setActiveTemplate(null)
  }

  function addIngredient() {
    setForm(f => ({ ...f, ingredients: [...f.ingredients, { inventoryItemId: 0, quantity: 0 }] }))
  }

  function removeIngredient(idx: number) {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }))
  }

  function setIngredient(idx: number, patch: Partial<ProductionIngredientRequest>) {
    setForm(f => ({ ...f, ingredients: f.ingredients.map((ing, i) => i === idx ? { ...ing, ...patch } : ing) }))
  }

  function loadFromTemplate(templateId: number) {
    const t = templates.find(t => t.id === templateId)
    if (!t) return
    setActiveTemplate(t)
    setForm(f => ({
      ...f,
      outputItemId: t.outputItemId,
      yieldQuantity: t.baseYield,
      ingredients: t.ingredients.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantity })),
    }))
  }

  function handleYieldChange(qty: number) {
    if (activeTemplate && qty > 0 && activeTemplate.baseYield > 0) {
      const factor = qty / activeTemplate.baseYield
      setForm(f => ({
        ...f,
        yieldQuantity: qty,
        ingredients: activeTemplate.ingredients.map(i => ({
          inventoryItemId: i.inventoryItemId,
          quantity: parseFloat((i.quantity * factor).toFixed(3)),
        })),
      }))
    } else {
      setForm(f => ({ ...f, yieldQuantity: qty }))
    }
  }

  function handleSubmit() {
    setError('')
    if (!form.outputItemId)                  { setError('Selecciona el artículo de salida'); return }
    if (!form.yieldQuantity || form.yieldQuantity <= 0) { setError('Cantidad producida inválida'); return }
    if (form.ingredients.length === 0)       { setError('Agrega al menos un ingrediente'); return }
    for (const ing of form.ingredients) {
      if (!ing.inventoryItemId)              { setError('Selecciona todos los ingredientes'); return }
      if (!ing.quantity || ing.quantity <= 0) { setError('Cantidades de ingredientes inválidas'); return }
    }
    createMut.mutate(form)
  }

  // ── template helpers ──────────────────────────────────────────────────────
  function closeTemplateForm() {
    setShowTemplateForm(false)
    setEditingTemplate(null)
    setTemplateForm(emptyTemplateForm())
    setTemplateError('')
  }

  function openEditTemplate(t: ProductionTemplateResponse) {
    setEditingTemplate(t)
    // Derivar la unidad desde el item actual — ignora el valor guardado (puede estar desactualizado)
    const outputItem = producedItems.find(i => i.id === t.outputItemId)
    const derivedUnit = outputItem ? unitLabel(outputItem.unitType) : t.baseYieldUnit
    setTemplateForm({
      name: t.name,
      outputItemId: t.outputItemId,
      baseYield: t.baseYield,
      baseYieldUnit: derivedUnit,
      preparationInstructions: t.preparationInstructions ?? '',
      ingredients: t.ingredients.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantity })),
    })
    setSelectedTemplate(null)
    setShowTemplateForm(true)
  }

  function addTemplateIngredient() {
    setTemplateForm(f => ({ ...f, ingredients: [...f.ingredients, { inventoryItemId: 0, quantity: 0 }] }))
  }

  function removeTemplateIngredient(idx: number) {
    setTemplateForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }))
  }

  function setTemplateIngredient(idx: number, patch: Partial<ProductionTemplateIngredientRequest>) {
    setTemplateForm(f => ({
      ...f,
      ingredients: f.ingredients.map((ing, i) => i === idx ? { ...ing, ...patch } : ing),
    }))
  }

  function handleTemplateSubmit() {
    setTemplateError('')
    if (!templateForm.name.trim())                              { setTemplateError('El nombre es requerido'); return }
    if (!templateForm.outputItemId)                            { setTemplateError('Selecciona la elaboración que produce'); return }
    if (!templateForm.baseYield || templateForm.baseYield <= 0) { setTemplateError('El rendimiento debe ser mayor a 0'); return }
    for (const ing of templateForm.ingredients) {
      if (!ing.inventoryItemId)                              { setTemplateError('Selecciona el insumo en cada fila'); return }
      if (!ing.quantity || ing.quantity <= 0)                { setTemplateError('Todas las cantidades deben ser mayores a 0'); return }
    }
    if (editingTemplate) {
      updateTemplateMut.mutate({ id: editingTemplate.id, data: templateForm })
    } else {
      createTemplateMut.mutate(templateForm)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChefHat className="text-amber-600" size={22} />
          <h1 className="text-lg font-bold text-slate-800">Elaboraciones propias</h1>
        </div>
        <button
          onClick={() => {
            if (view === 'lotes') { setShowForm(true); setError('') }
            else { setShowTemplateForm(true); setTemplateError('') }
          }}
          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
        >
          <Plus size={16} /> {view === 'lotes' ? 'Nueva producción' : 'Nueva receta'}
        </button>
      </div>

      {/* Banner: insumos insuficientes — resurtido auto-creado */}
      {stockAlert && (
        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-amber-800 font-semibold text-sm mb-1">
                No hay insumos suficientes para producir este lote
              </p>
              <p className="text-amber-700 text-sm mb-3">
                El sistema ha creado el resurtido <span className="font-bold">{stockAlert.folio}</span> a bodega central
                con los insumos faltantes. Una vez que compres y confirmes ese resurtido, podrás
                confirmar este lote de producción.
              </p>
              <div className="space-y-2">
                {stockAlert.items.map(w => (
                  <div key={w.inventoryItemId} className="text-xs text-amber-700">
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      <span className="font-semibold text-amber-900">{w.name}</span>
                      <span>Necesario: <strong>{fmtQty(w.required, w.unitType)}</strong></span>
                      <span>Disponible: <strong>{fmtQty(w.available, w.unitType)}</strong></span>
                      <span className="text-red-600">Faltan: <strong>{fmtQty(w.missing, w.unitType)}</strong></span>
                    </div>
                    {w.containersNeeded != null && w.containerLabel && w.orderedQuantity != null && (
                      <div className="mt-0.5 text-teal-700 bg-teal-50 rounded px-2 py-1">
                        Se pedirán <strong>{w.containersNeeded} {w.containerLabel}{w.containersNeeded !== 1 ? 's' : ''}</strong>
                        {' '}→ <strong>{fmtQty(w.orderedQuantity, w.unitType)}</strong>
                        {w.orderedQuantity > w.missing && (
                          <span className="text-slate-500"> (el sobrante queda en bodega)</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setStockAlert(null)} className="text-amber-500 hover:text-amber-700 shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-4">
        <button
          onClick={() => setView('plantillas')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            view === 'plantillas' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen size={13} /> Recetas
        </button>
        <button
          onClick={() => setView('lotes')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === 'lotes' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Producciones
        </button>
      </div>

      {/* ── LOTES VIEW ──────────────────────────────────────────────────────── */}
      {view === 'lotes' && (
        <>
          {error && !showForm && (
            <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-center justify-between">
              {error}<button onClick={() => setError('')}><X size={14} /></button>
            </div>
          )}

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
                  <button key={p.id} onClick={() => { setSelected(p); setError('') }}
                    className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
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
                        {p.totalCost != null && <span className="text-xs text-slate-500">{fmt(p.totalCost)}</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── PLANTILLAS VIEW ─────────────────────────────────────────────────── */}
      {view === 'plantillas' && (
        <>
          {loadingTemplates ? (
            <p className="text-slate-400 text-sm text-center py-8">Cargando plantillas...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BookOpen size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium text-slate-500">Sin recetas todavía</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">Registra la receta de cada elaboración propia — ingredientes, gramajes y pasos opcionales. Desde aquí podrás iniciar producciones rápidamente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <button key={t.id} onClick={() => { setSelectedTemplate(t); setShowInstructions(false) }}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t.outputItemName} · rinde {t.baseYield} {t.baseYieldUnit}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{t.ingredients.length} ingredientes</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ MODAL: NUEVO LOTE ═══════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Nuevo lote</h2>
              <button onClick={closeForm}><X size={20} /></button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
              )}

              {/* Cargar desde plantilla */}
              {templates.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cargar desde plantilla</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) loadFromTemplate(Number(e.target.value))
                      else { setActiveTemplate(null); setForm(f => ({ ...f, ingredients: [] })) }
                    }}
                  >
                    <option value="">Sin plantilla</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} (rinde {t.baseYield} {t.baseYieldUnit})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Artículo producido */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Elaboración a producir</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.outputItemId || ''}
                  onChange={e => setForm(f => ({ ...f, outputItemId: Number(e.target.value) }))}
                >
                  <option value="">Seleccionar...</option>
                  {producedItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({unitLabel(i.unitType)})</option>
                  ))}
                </select>
              </div>

              {/* Cantidad */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Cantidad a producir
                  {form.outputItemId > 0 && (() => {
                    const u = producedItems.find(i => i.id === form.outputItemId)
                    return u ? <span className="text-slate-400 font-normal ml-1">({unitLabel(u.unitType)})</span> : null
                  })()}
                </label>
                <input type="number" min="0" step="0.001"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.yieldQuantity || ''}
                  onChange={e => handleYieldChange(Number(e.target.value))}
                />
                {activeTemplate && form.yieldQuantity > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                      ×{(form.yieldQuantity / activeTemplate.baseYield).toFixed(2)} escala
                    </span>
                    <span className="text-xs text-slate-400">
                      base: {activeTemplate.baseYield} {activeTemplate.baseYieldUnit} — ingredientes ajustados automáticamente
                    </span>
                  </div>
                )}
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Fecha de producción <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input type="date"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.producedAt ?? ''}
                  min={today()}
                  max={maxProductionDate()}
                  onChange={e => setForm(f => ({ ...f, producedAt: e.target.value }))}
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
                <textarea rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Ingredientes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">Ingredientes</label>
                  <button onClick={addIngredient}
                    className="text-xs text-amber-600 font-medium flex items-center gap-1 hover:underline">
                    <Plus size={13} /> Agregar
                  </button>
                </div>
                {form.ingredients.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">Sin ingredientes</p>
                ) : (
                  <div className="space-y-2">
                    {form.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          value={ing.inventoryItemId || ''}
                          onChange={e => setIngredient(idx, { inventoryItemId: Number(e.target.value) })}>
                          <option value="">Insumo...</option>
                          {activeItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <input type="number" min="0" step="0.001" placeholder="Qty"
                          className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          value={ing.quantity || ''}
                          onChange={e => setIngredient(idx, { quantity: Number(e.target.value) })} />
                        <button onClick={() => removeIngredient(idx)} className="text-red-400 hover:text-red-600">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handleSubmit} disabled={createMut.isPending}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">
                {createMut.isPending ? 'Guardando...' : 'Guardar borrador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: DETALLE LOTE ═════════════════════════════════════════════════ */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 truncate">{selected.outputItemName}</h2>
              <button onClick={() => { setSelected(null); setError(''); setPendingAction(null) }}><X size={20} /></button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
              )}

              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_LABELS[selected.status].color}`}>
                  {STATUS_LABELS[selected.status].label}
                </span>
                {selected.producedAt && <span className="text-xs text-slate-500">Fecha: {selected.producedAt}</span>}
              </div>

              <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Cantidad</p>
                  <p className="font-semibold text-slate-800">{fmtQty(selected.yieldQuantity, selected.outputItemUnit)}</p>
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

              {selected.notes && <p className="text-sm text-slate-600 italic">"{selected.notes}"</p>}

              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <Package size={13} /> Ingredientes
                </p>
                <div className="space-y-1.5">
                  {selected.ingredients.map(ing => (
                    <div key={ing.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-slate-700">{ing.inventoryItemName}</span>
                      <div className="text-right">
                        <p className="text-slate-600">{fmtQty(ing.quantity, ing.unitType)}</p>
                        {ing.unitCostSnapshot != null && <p className="text-xs text-slate-400">{fmt(ing.totalCost)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.status === 'CANCELLED' && selected.cancelReason && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Motivo de cancelación</p>
                  <p className="text-sm text-red-800">{selected.cancelReason}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {selected.status === 'DRAFT' && (
                  <>
                    {pendingAction === 'confirm' ? (
                      <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                        <p className="text-sm font-medium text-emerald-800 mb-2">
                          ¿Confirmar producción? Se descontarán los ingredientes del inventario y no podrá deshacerse.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { confirmMut.mutate(selected.id); setPendingAction(null) }}
                            disabled={confirmMut.isPending}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm"
                          >
                            {confirmMut.isPending ? 'Confirmando...' : 'Sí, confirmar'}
                          </button>
                          <button
                            onClick={() => setPendingAction(null)}
                            className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2 rounded-lg text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : pendingAction === 'delete' ? (
                      <div className="flex-1 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <p className="text-sm font-medium text-red-800 mb-2">
                          ¿Eliminar este borrador? Esta acción no puede deshacerse.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { deleteMut.mutate(selected.id); setPendingAction(null) }}
                            disabled={deleteMut.isPending}
                            className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm"
                          >
                            {deleteMut.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                          </button>
                          <button
                            onClick={() => setPendingAction(null)}
                            className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2 rounded-lg text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setPendingAction('confirm')}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-sm"
                        >
                          <CheckCircle2 size={16} /> Confirmar producción
                        </button>
                        <button
                          onClick={() => setPendingAction('delete')}
                          className="flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 px-3 rounded-xl text-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </>
                )}
                {selected.status === 'CONFIRMED' && (
                  <p className="text-sm text-emerald-600 text-center w-full py-2 font-medium">
                    Producción confirmada — inventario actualizado
                  </p>
                )}
                {selected.status === 'CANCELLED' && (
                  <p className="text-sm text-red-500 text-center w-full py-2 font-medium">
                    Producción cancelada — sin cambios en inventario
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: DETALLE PLANTILLA ════════════════════════════════════════════ */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 truncate">{selectedTemplate.name}</h2>
              <button onClick={() => setSelectedTemplate(null)}><X size={20} /></button>
            </div>

            <div className="p-4 space-y-4">
              {/* Info base */}
              <div className="bg-amber-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Produce</p>
                  <p className="font-semibold text-slate-800">{selectedTemplate.outputItemName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rendimiento base</p>
                  <p className="font-semibold text-slate-800">{selectedTemplate.baseYield} {selectedTemplate.baseYieldUnit}</p>
                </div>
              </div>

              {/* Ingredientes */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <Package size={13} /> Ingredientes para {selectedTemplate.baseYield} {selectedTemplate.baseYieldUnit}
                </p>
                <div className="space-y-1.5">
                  {selectedTemplate.ingredients.map(ing => (
                    <div key={ing.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-slate-700">{ing.inventoryItemName}</span>
                      <span className="text-slate-600">{fmtQty(ing.quantity, ing.unitType)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instrucciones de preparación */}
              {selectedTemplate.preparationInstructions && (
                <div>
                  <button
                    onClick={() => setShowInstructions(v => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 w-full"
                  >
                    <BookOpen size={14} className="text-amber-500" />
                    Instrucciones de preparación
                    {showInstructions ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
                  </button>
                  {showInstructions && (
                    <div className="mt-2 bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                      {selectedTemplate.preparationInstructions}
                    </div>
                  )}
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setSelectedTemplate(null)
                    setShowForm(true)
                    setView('lotes')
                    loadFromTemplate(selectedTemplate.id)
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm"
                >
                  <FlaskConical size={16} /> Usar plantilla
                </button>
                <button onClick={() => openEditTemplate(selectedTemplate)}
                  className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-3 rounded-xl text-sm">
                  <Pencil size={16} />
                </button>
                <button onClick={() => archiveTemplateMut.mutate(selectedTemplate.id)} disabled={archiveTemplateMut.isPending}
                  className="flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 px-3 rounded-xl text-sm">
                  <Archive size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: FORM PLANTILLA ═══════════════════════════════════════════════ */}
      {showTemplateForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">
                {editingTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
              </h2>
              <button onClick={closeTemplateForm}><X size={20} /></button>
            </div>

            <div className="p-4 space-y-4">
              {templateError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{templateError}</div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la receta</label>
                <input type="text" placeholder="Ej. Esquite hervido estilo la casa"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={templateForm.name}
                  onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Elaboración que produce */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Elaboración que produce</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={templateForm.outputItemId || ''}
                  onChange={e => {
                    const id = Number(e.target.value)
                    const item = producedItems.find(i => i.id === id)
                    setTemplateForm(f => ({
                      ...f,
                      outputItemId: id,
                      baseYieldUnit: item ? unitLabel(item.unitType) : f.baseYieldUnit,
                    }))
                  }}
                >
                  <option value="">Seleccionar...</option>
                  {producedItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({unitLabel(i.unitType)})</option>
                  ))}
                </select>
                {producedItems.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Primero registra insumos de tipo "Elaboración propia" en el módulo de Inventario.
                  </p>
                )}
              </div>

              {/* Rendimiento base */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Esta receta rinde
                </label>
                <div className="flex gap-2 items-center">
                  <input type="number" min="0" step="0.001" placeholder="Ej. 1000"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={templateForm.baseYield || ''}
                    onChange={e => setTemplateForm(f => ({ ...f, baseYield: Number(e.target.value) }))}
                  />
                  <select
                    className="border border-slate-300 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    value={templateForm.baseYieldUnit}
                    onChange={e => setTemplateForm(f => ({ ...f, baseYieldUnit: e.target.value }))}
                  >
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                    <option value="pza">pza</option>
                    <option value="porciones">porciones</option>
                  </select>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Indica cuánto produce seguir esta receta completa. Al registrar una producción podrás escalar la cantidad.
                </p>
              </div>

              {/* Ingredientes (opcionales) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">
                    Insumos / ingredientes <span className="font-normal text-slate-400">(opcional)</span>
                  </label>
                  <button onClick={addTemplateIngredient}
                    className="text-xs text-amber-600 font-medium flex items-center gap-1 hover:underline">
                    <Plus size={13} /> Agregar
                  </button>
                </div>
                {templateForm.ingredients.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg space-y-0.5">
                    <p>Sin ingredientes — puedes agregar después</p>
                    <p className="text-slate-300">Si la receta es privada, puedes omitirlos</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templateForm.ingredients.map((ing, idx) => {
                      const selected = purchasedItems.find(i => i.id === ing.inventoryItemId)
                      return (
                        <div key={idx} className="flex gap-2 items-center">
                          <select
                            className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            value={ing.inventoryItemId || ''}
                            onChange={e => setTemplateIngredient(idx, { inventoryItemId: Number(e.target.value) })}>
                            <option value="">Insumo...</option>
                            {purchasedItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </select>
                          <div className="relative w-28">
                            <input type="number" min="0" step="0.001"
                              placeholder="Cant."
                              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 pr-7"
                              value={ing.quantity || ''}
                              onChange={e => setTemplateIngredient(idx, { quantity: Number(e.target.value) })} />
                            {selected && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                                {unitLabel(selected.unitType)}
                              </span>
                            )}
                          </div>
                          <button onClick={() => removeTemplateIngredient(idx)} className="text-red-400 hover:text-red-600 shrink-0">
                            <X size={16} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Instrucciones (opcional) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Instrucciones de preparación <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <textarea rows={5} placeholder="Describe el proceso de preparación..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  value={templateForm.preparationInstructions ?? ''}
                  onChange={e => setTemplateForm(f => ({ ...f, preparationInstructions: e.target.value }))}
                />
              </div>

              <button
                onClick={handleTemplateSubmit}
                disabled={createTemplateMut.isPending || updateTemplateMut.isPending}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm"
              >
                {createTemplateMut.isPending || updateTemplateMut.isPending
                  ? 'Guardando...'
                  : editingTemplate ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}