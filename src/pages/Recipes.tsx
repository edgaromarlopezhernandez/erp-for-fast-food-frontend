import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProducts } from '../api/products'
import { getInventory } from '../api/inventory'
import {
  getRecipeByProduct, saveRecipe, deleteRecipe,
  addRecipeExtra, updateRecipeExtra, deleteRecipeExtra,
} from '../api/recipes'
import { getModifierGroups, createModifierGroup, updateModifierGroup, deleteModifierGroup } from '../api/modifiers'
import type { Product, InventoryItem, RecipeItemRequest, RecipeExtra, ProductModifierGroup } from '../types'
import { BookOpen, Plus, Trash2, X, ChevronDown, Sparkles, Pencil, AlertTriangle, Lock, Unlock, ToggleLeft, ToggleRight, SlidersHorizontal } from 'lucide-react'

interface ExtraForm { name: string; extraPrice: string; inventoryItemId: number; quantityRequired: string }
const EMPTY_EXTRA: ExtraForm = { name: '', extraPrice: '', inventoryItemId: 0, quantityRequired: '' }

interface ModifierItemForm { inventoryItemId: number; quantityRequired: string }
interface ModifierForm { name: string; priceAdjustment: string; recipeItems: ModifierItemForm[] }
interface GroupForm { name: string; required: boolean; modifiers: ModifierForm[] }
const EMPTY_MODIFIER: ModifierForm = { name: '', priceAdjustment: '0', recipeItems: [] }
const EMPTY_GROUP: GroupForm = { name: '', required: true, modifiers: [{ ...EMPTY_MODIFIER }] }

export default function Recipes() {
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const { data: inventory = [] } = useQuery({ queryKey: ['inventory'], queryFn: getInventory })
  const [selected, setSelected] = useState<Product | null>(null)
  const [recipeId, setRecipeId] = useState<number | null>(null)
  const [items, setItems] = useState<RecipeItemRequest[]>([])
  const [extras, setExtras] = useState<RecipeExtra[]>([])
  const [loadingRecipe, setLoadingRecipe] = useState(false)

  // Extra form state
  const [showExtraForm, setShowExtraForm] = useState(false)
  const [editingExtra, setEditingExtra] = useState<RecipeExtra | null>(null)
  const [extraForm, setExtraForm] = useState<ExtraForm>(EMPTY_EXTRA)
  const [extraError, setExtraError] = useState('')

  // Modifier groups state
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ProductModifierGroup | null>(null)
  const [groupForm, setGroupForm] = useState<GroupForm>(EMPTY_GROUP)
  const [groupError, setGroupError] = useState('')

  const qc = useQueryClient()

  // Fetch modifier groups for the selected product
  const { data: modifierGroups = [], refetch: refetchGroups } = useQuery({
    queryKey: ['modifier-groups', selected?.id],
    queryFn: () => getModifierGroups(selected!.id),
    enabled: !!selected,
  })

  const loadRecipe = async (product: Product) => {
    setSelected(product)
    setLoadingRecipe(true)
    setShowExtraForm(false)
    setEditingExtra(null)
    setShowGroupModal(false)
    setEditingGroup(null)
    try {
      const recipe = await getRecipeByProduct(product.id)
      setRecipeId(recipe.id)
      setItems(recipe.items.map((i) => ({ inventoryItemId: i.inventoryItemId, quantityRequired: i.quantityRequired, canExclude: i.canExclude })))
      setExtras(recipe.extras ?? [])
    } catch {
      setRecipeId(null)
      setItems([])
      setExtras([])
    } finally {
      setLoadingRecipe(false)
    }
  }

  const addItem = () => setItems([...items, { inventoryItemId: 0, quantityRequired: 0, canExclude: true }])
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i: number, key: keyof RecipeItemRequest, val: number) =>
    setItems(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  const toggleCanExclude = (i: number) =>
    setItems(items.map((item, idx) => idx === i ? { ...item, canExclude: !item.canExclude } : item))

  const saveMut = useMutation({
    mutationFn: () => saveRecipe({ productId: selected!.id, items }),
    onSuccess: (recipe) => {
      setRecipeId(recipe.id)
      setExtras(recipe.extras ?? [])
      qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteRecipe(selected!.id),
    onSuccess: () => {
      setItems([]); setExtras([]); setRecipeId(null)
      qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })

  const addExtraMut = useMutation({
    mutationFn: () => addRecipeExtra({
      recipeId: recipeId!,
      name: extraForm.name.trim(),
      extraPrice: parseFloat(extraForm.extraPrice),
      inventoryItemId: extraForm.inventoryItemId,
      quantityRequired: parseFloat(extraForm.quantityRequired),
    }),
    onSuccess: (recipe) => {
      setExtras(recipe.extras ?? [])
      setShowExtraForm(false)
      setExtraForm(EMPTY_EXTRA)
      setExtraError('')
      qc.invalidateQueries({ queryKey: ['recipes'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setExtraError(msg || 'Error al guardar el extra')
    },
  })

  const updateExtraMut = useMutation({
    mutationFn: () => updateRecipeExtra(editingExtra!.id, {
      name: extraForm.name.trim(),
      extraPrice: parseFloat(extraForm.extraPrice),
      inventoryItemId: extraForm.inventoryItemId,
      quantityRequired: parseFloat(extraForm.quantityRequired),
    }),
    onSuccess: (recipe) => {
      setExtras(recipe.extras ?? [])
      setShowExtraForm(false)
      setEditingExtra(null)
      setExtraForm(EMPTY_EXTRA)
      setExtraError('')
      qc.invalidateQueries({ queryKey: ['recipes'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setExtraError(msg || 'Error al actualizar el extra')
    },
  })

  const deleteExtraMut = useMutation({
    mutationFn: (id: number) => deleteRecipeExtra(id),
    onSuccess: () => loadRecipe(selected!),
  })

  const openAddExtra = () => {
    setEditingExtra(null); setExtraForm(EMPTY_EXTRA); setExtraError(''); setShowExtraForm(true)
  }
  const openEditExtra = (extra: RecipeExtra) => {
    setEditingExtra(extra)
    setExtraForm({ name: extra.name, extraPrice: String(extra.extraPrice), inventoryItemId: extra.inventoryItemId, quantityRequired: String(extra.quantityRequired) })
    setExtraError(''); setShowExtraForm(true)
  }
  const submitExtra = () => {
    if (!extraForm.name.trim()) { setExtraError('El nombre es obligatorio'); return }
    if (!extraForm.extraPrice || isNaN(parseFloat(extraForm.extraPrice))) { setExtraError('El precio es obligatorio'); return }
    if (!extraForm.inventoryItemId) { setExtraError('Selecciona un insumo'); return }
    if (!extraForm.quantityRequired || isNaN(parseFloat(extraForm.quantityRequired))) { setExtraError('La cantidad es obligatoria'); return }
    editingExtra ? updateExtraMut.mutate() : addExtraMut.mutate()
  }

  // ── Modifier group mutations ────────────────────────────────────────────────
  const saveGroupMut = useMutation({
    mutationFn: () => {
      const payload = {
        productId: selected!.id,
        name: groupForm.name.trim(),
        required: groupForm.required,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 0,
        modifiers: groupForm.modifiers.map((m, mi) => ({
          name: m.name.trim(),
          priceAdjustment: parseFloat(m.priceAdjustment) || 0,
          sortOrder: mi,
          recipeItems: m.recipeItems
            .filter(ri => ri.inventoryItemId && ri.quantityRequired)
            .map(ri => ({ inventoryItemId: ri.inventoryItemId, quantityRequired: parseFloat(ri.quantityRequired) })),
        })),
      }
      return editingGroup
        ? updateModifierGroup(editingGroup.id, payload)
        : createModifierGroup(payload)
    },
    onSuccess: () => {
      setShowGroupModal(false)
      setEditingGroup(null)
      setGroupForm(EMPTY_GROUP)
      setGroupError('')
      refetchGroups()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setGroupError(msg || 'Error al guardar el grupo')
    },
  })

  const deleteGroupMut = useMutation({
    mutationFn: (id: number) => deleteModifierGroup(id),
    onSuccess: () => refetchGroups(),
  })

  const openNewGroup = () => {
    setEditingGroup(null)
    setGroupForm(EMPTY_GROUP)
    setGroupError('')
    setShowGroupModal(true)
  }

  const openEditGroup = (g: ProductModifierGroup) => {
    setEditingGroup(g)
    setGroupForm({
      name: g.name,
      required: g.required,
      modifiers: g.modifiers.map(m => ({
        name: m.name,
        priceAdjustment: String(m.priceAdjustment),
        recipeItems: m.recipeItems.map(ri => ({
          inventoryItemId: ri.inventoryItemId,
          quantityRequired: String(ri.quantityRequired),
        })),
      })),
    })
    setGroupError('')
    setShowGroupModal(true)
  }

  const submitGroup = () => {
    if (!groupForm.name.trim()) { setGroupError('El nombre del grupo es obligatorio'); return }
    if (groupForm.modifiers.length === 0) { setGroupError('Agrega al menos una opción'); return }
    if (groupForm.modifiers.some(m => !m.name.trim())) { setGroupError('Todas las opciones deben tener nombre'); return }
    saveGroupMut.mutate()
  }

  const updateModifier = (mi: number, key: keyof ModifierForm, val: string) =>
    setGroupForm(f => ({ ...f, modifiers: f.modifiers.map((m, i) => i === mi ? { ...m, [key]: val } : m) }))

  const removeModifier = (mi: number) =>
    setGroupForm(f => ({ ...f, modifiers: f.modifiers.filter((_, i) => i !== mi) }))

  const addModifierRecipeItem = (mi: number) =>
    setGroupForm(f => ({
      ...f,
      modifiers: f.modifiers.map((m, i) =>
        i === mi ? { ...m, recipeItems: [...m.recipeItems, { inventoryItemId: 0, quantityRequired: '' }] } : m
      ),
    }))

  const updateModifierRecipeItem = (mi: number, ri: number, key: keyof ModifierItemForm, val: string | number) =>
    setGroupForm(f => ({
      ...f,
      modifiers: f.modifiers.map((m, i) =>
        i === mi ? { ...m, recipeItems: m.recipeItems.map((r, j) => j === ri ? { ...r, [key]: val } : r) } : m
      ),
    }))

  const removeModifierRecipeItem = (mi: number, ri: number) =>
    setGroupForm(f => ({
      ...f,
      modifiers: f.modifiers.map((m, i) =>
        i === mi ? { ...m, recipeItems: m.recipeItems.filter((_, j) => j !== ri) } : m
      ),
    }))

  const unitLabel = (id: number) => {
    const item = (inventory as InventoryItem[]).find((i) => i.id === id)
    if (!item) return ''
    return item.unitType === 'PIECE' ? 'pza' : item.unitType === 'GRAM' ? 'g' : 'ml'
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Recetas</h2>
      <p className="text-slate-500 text-sm">Configura insumos base y extras opcionales de cada producto.</p>

      {inventory.length === 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3.5">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Sin insumos en inventario.</span>{' '}
            Para configurar recetas primero debes agregar los insumos que utilizas en tu negocio desde la sección{' '}
            <a href="/inventory" className="underline font-medium hover:text-amber-900">Inventario</a>.
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Product selector */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-medium text-sm text-slate-600">
            Seleccionar producto
          </div>
          <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {products.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => loadRecipe(p)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                    selected?.id === p.id ? 'bg-violet-50 text-violet-700' : ''
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-slate-400">${p.salePrice}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} className={selected?.id === p.id ? 'text-violet-500' : 'text-slate-300'} />
                    <ChevronDown size={14} className="text-slate-300" />
                  </div>
                </button>
              </li>
            ))}
            {products.length === 0 && (
              <li className="px-4 py-8 text-center text-slate-400 text-sm">No hay productos. Crea uno primero.</li>
            )}
          </ul>
        </div>

        {/* Recipe editor */}
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
          {!selected ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <BookOpen size={28} className="mx-auto mb-2 text-slate-300" />
              Selecciona un producto para ver o editar su receta
            </div>
          ) : loadingRecipe ? (
            <div className="py-8 text-center text-slate-400 text-sm">Cargando...</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-semibold text-slate-800 text-sm">{selected.name}</p>
                <p className="text-xs text-slate-400">Receta base + extras opcionales</p>
              </div>

              {/* Ingredientes base */}
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingredientes base</p>
                <button onClick={addItem}
                  className="flex items-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-600 font-medium px-2.5 py-1 rounded-lg">
                  <Plus size={12} /> Insumo
                </button>
              </div>
              {items.length > 0 && (
                <div className="px-4 pb-1 flex items-center gap-1 text-xs text-slate-400">
                  <Unlock size={11} className="text-green-500" /> <span>puede quitarse</span>
                  <span className="mx-1">·</span>
                  <Lock size={11} className="text-slate-400" /> <span>siempre incluido</span>
                </div>
              )}
              <div className="px-4 pb-3 space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={item.inventoryItemId || ''}
                      onChange={(e) => updateItem(i, 'inventoryItemId', parseInt(e.target.value))}
                      className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                    >
                      <option value="">Seleccionar insumo</option>
                      {(inventory as InventoryItem[]).map((inv) => (
                        <option key={inv.id} value={inv.id}>{inv.name}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1 w-24">
                      <input type="number" step="0.001" value={item.quantityRequired}
                        onChange={(e) => updateItem(i, 'quantityRequired', parseFloat(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                        placeholder="0" />
                      <span className="text-xs text-slate-400 w-6 shrink-0">{unitLabel(item.inventoryItemId)}</span>
                    </div>
                    <button
                      onClick={() => toggleCanExclude(i)}
                      title={item.canExclude ? 'El cliente puede pedirlo sin este ingrediente — clic para fijarlo' : 'Siempre incluido — clic para permitir quitarlo'}
                      className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                        item.canExclude
                          ? 'bg-green-50 text-green-600 hover:bg-green-100'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {item.canExclude ? <Unlock size={13} /> : <Lock size={13} />}
                    </button>
                    <button onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500"><X size={15} /></button>
                  </div>
                ))}
                {items.length === 0 && <p className="text-slate-400 text-xs text-center py-2">Sin insumos base.</p>}
              </div>

              {/* Extras opcionales */}
              <div className="px-4 pt-2 pb-1 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Extras opcionales</p>
                </div>
                {recipeId && (
                  <button onClick={openAddExtra}
                    className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-600 font-medium px-2.5 py-1 rounded-lg">
                    <Plus size={12} /> Extra
                  </button>
                )}
              </div>
              <div className="px-4 pb-3 space-y-2">
                {!recipeId && (
                  <p className="text-xs text-slate-400 text-center py-2">Guarda la receta base primero para agregar extras.</p>
                )}
                {recipeId && extras.length === 0 && !showExtraForm && (
                  <p className="text-xs text-slate-400 text-center py-2">Sin extras definidos.</p>
                )}
                {extras.map((extra) => (
                  <div key={extra.id} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{extra.name}</p>
                      <p className="text-xs text-slate-500">{extra.inventoryItemName} · {extra.quantityRequired} {unitLabel(extra.inventoryItemId)}</p>
                    </div>
                    <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                      +${extra.extraPrice.toFixed(2)}
                    </span>
                    <button onClick={() => openEditExtra(extra)} className="text-slate-400 hover:text-violet-500"><Pencil size={13} /></button>
                    <button onClick={() => deleteExtraMut.mutate(extra.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                ))}

                {showExtraForm && recipeId && (
                  <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/50 space-y-2">
                    <p className="text-xs font-semibold text-amber-700">{editingExtra ? 'Editar extra' : 'Nuevo extra'}</p>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">Insumo</label>
                      <select value={extraForm.inventoryItemId || ''}
                        onChange={(e) => {
                          const id = parseInt(e.target.value)
                          const inv = (inventory as InventoryItem[]).find(i => i.id === id)
                          setExtraForm(f => ({
                            ...f,
                            inventoryItemId: id,
                            name: f.name.trim() === '' ? (inv?.name ?? '') : f.name,
                          }))
                        }}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400">
                        <option value="">Seleccionar insumo</option>
                        {(inventory as InventoryItem[]).map((inv) => (
                          <option key={inv.id} value={inv.id}>{inv.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">Nombre que verá el cliente</label>
                      <input type="text" placeholder="ej: Con cacahuates, Con mayonesa…"
                        value={extraForm.name} onChange={(e) => setExtraForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 block mb-0.5">Precio adicional $</label>
                        <input type="number" min={0} step="0.50" placeholder="0.00"
                          value={extraForm.extraPrice} onChange={(e) => setExtraForm(f => ({ ...f, extraPrice: e.target.value }))}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 block mb-0.5">Cantidad a descontar ({unitLabel(extraForm.inventoryItemId)})</label>
                        <input type="number" min={0} step="0.001" placeholder="0"
                          value={extraForm.quantityRequired} onChange={(e) => setExtraForm(f => ({ ...f, quantityRequired: e.target.value }))}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                    </div>
                    {extraError && <p className="text-xs text-red-500">{extraError}</p>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setShowExtraForm(false); setEditingExtra(null); setExtraError('') }}
                        className="flex-1 border border-slate-300 text-slate-600 text-xs py-1.5 rounded-lg hover:bg-slate-50">
                        Cancelar
                      </button>
                      <button onClick={submitExtra}
                        disabled={addExtraMut.isPending || updateExtraMut.isPending}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded-lg">
                        {addExtraMut.isPending || updateExtraMut.isPending ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Grupos de modificadores */}
              <div className="px-4 pt-2 pb-1 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className="text-violet-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grupos de modificadores</p>
                </div>
                {recipeId && (
                  <button onClick={openNewGroup}
                    className="flex items-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-600 font-medium px-2.5 py-1 rounded-lg">
                    <Plus size={12} /> Grupo
                  </button>
                )}
              </div>
              <div className="px-4 pb-3 space-y-2">
                {!recipeId && (
                  <p className="text-xs text-slate-400 text-center py-2">Guarda la receta base primero para agregar grupos de modificadores.</p>
                )}
                {recipeId && modifierGroups.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">Sin grupos configurados. Útil para variantes como "Tipo de esquite".</p>
                )}
                {modifierGroups.map((g) => (
                  <div key={g.id} className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800 truncate">{g.name}</p>
                          {g.required && (
                            <span className="text-xs bg-violet-200 text-violet-700 px-1.5 py-0.5 rounded-full shrink-0">requerido</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {g.modifiers.map(m => (
                            <span key={m.id} className="text-xs bg-white border border-violet-200 text-slate-700 px-2 py-0.5 rounded-full">
                              {m.name}
                              {m.priceAdjustment > 0 && <span className="text-violet-600 font-semibold"> +${m.priceAdjustment.toFixed(2)}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => openEditGroup(g)} className="text-slate-400 hover:text-violet-500 shrink-0"><Pencil size={13} /></button>
                      <button onClick={() => deleteGroupMut.mutate(g.id)} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-slate-100 flex gap-3 mt-auto">
                <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
                  className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 font-medium">
                  <Trash2 size={14} /> Eliminar receta
                </button>
                <button onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending || items.length === 0}
                  className="ml-auto bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                  {saveMut.isPending ? 'Guardando...' : 'Guardar receta base'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal: crear / editar grupo de modificadores ─────────────────── */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800">{editingGroup ? 'Editar grupo' : 'Nuevo grupo de modificadores'}</h3>
                <p className="text-xs text-slate-400">Ej: "Tipo de esquite" con opciones Hervido, Frito, Con tuétano</p>
              </div>
              <button onClick={() => { setShowGroupModal(false); setEditingGroup(null) }}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
              {/* Nombre y tipo */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-0.5">Nombre del grupo *</label>
                  <input
                    type="text"
                    placeholder="ej: Tipo de esquite, Sabor de maruchan…"
                    value={groupForm.name}
                    onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
                  <label className="text-xs text-slate-500">¿Requerido?</label>
                  <button
                    onClick={() => setGroupForm(f => ({ ...f, required: !f.required }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      groupForm.required
                        ? 'bg-violet-50 border-violet-300 text-violet-700'
                        : 'bg-slate-50 border-slate-300 text-slate-500'
                    }`}
                  >
                    {groupForm.required ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {groupForm.required ? 'Sí' : 'No'}
                  </button>
                </div>
              </div>

              {/* Opciones / modificadores */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Opciones</p>
                  <button
                    onClick={() => setGroupForm(f => ({ ...f, modifiers: [...f.modifiers, { ...EMPTY_MODIFIER }] }))}
                    className="flex items-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-600 font-medium px-2 py-1 rounded-lg"
                  >
                    <Plus size={11} /> Opción
                  </button>
                </div>

                <div className="space-y-3">
                  {groupForm.modifiers.map((mod, mi) => (
                    <div key={mi} className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={`Opción ${mi + 1} ej: Hervido`}
                          value={mod.name}
                          onChange={e => updateModifier(mi, 'name', e.target.value)}
                          className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                        />
                        <div className="flex items-center gap-1 w-28">
                          <span className="text-xs text-slate-400">+$</span>
                          <input
                            type="number"
                            min={0}
                            step="0.50"
                            placeholder="0.00"
                            value={mod.priceAdjustment}
                            onChange={e => updateModifier(mi, 'priceAdjustment', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        {groupForm.modifiers.length > 1 && (
                          <button onClick={() => removeModifier(mi)} className="text-slate-400 hover:text-red-500 shrink-0">
                            <X size={15} />
                          </button>
                        )}
                      </div>

                      {/* Recipe items del modificador */}
                      <div className="pl-1 space-y-1.5">
                        {mod.recipeItems.map((ri, rii) => (
                          <div key={rii} className="flex items-center gap-2">
                            <select
                              value={ri.inventoryItemId || ''}
                              onChange={e => updateModifierRecipeItem(mi, rii, 'inventoryItemId', parseInt(e.target.value))}
                              className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-violet-400"
                            >
                              <option value="">Insumo</option>
                              {(inventory as InventoryItem[]).map(inv => (
                                <option key={inv.id} value={inv.id}>{inv.name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.001"
                              placeholder="Cant."
                              value={ri.quantityRequired}
                              onChange={e => updateModifierRecipeItem(mi, rii, 'quantityRequired', e.target.value)}
                              className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-violet-400"
                            />
                            <span className="text-xs text-slate-400 w-6 shrink-0">{unitLabel(ri.inventoryItemId)}</span>
                            <button onClick={() => removeModifierRecipeItem(mi, rii)} className="text-slate-300 hover:text-red-400 shrink-0">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addModifierRecipeItem(mi)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600 font-medium"
                        >
                          <Plus size={11} /> Insumo a descontar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {groupError && <p className="text-xs text-red-500">{groupError}</p>}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => { setShowGroupModal(false); setEditingGroup(null); setGroupError('') }}
                className="flex-1 border border-slate-300 text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitGroup}
                disabled={saveGroupMut.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg"
              >
                {saveGroupMut.isPending ? 'Guardando...' : editingGroup ? 'Guardar cambios' : 'Crear grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
