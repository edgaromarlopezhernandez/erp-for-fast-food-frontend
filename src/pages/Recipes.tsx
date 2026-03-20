import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProducts } from '../api/products'
import { getInventory } from '../api/inventory'
import {
  getRecipeByProduct, saveRecipe, deleteRecipe,
  addRecipeExtra, updateRecipeExtra, deleteRecipeExtra,
} from '../api/recipes'
import type { Product, InventoryItem, RecipeItemRequest, RecipeExtra } from '../types'
import { BookOpen, Plus, Trash2, X, ChevronDown, Sparkles, Pencil } from 'lucide-react'

interface ExtraForm { name: string; extraPrice: string; inventoryItemId: number; quantityRequired: string }
const EMPTY_EXTRA: ExtraForm = { name: '', extraPrice: '', inventoryItemId: 0, quantityRequired: '' }

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

  const qc = useQueryClient()

  const loadRecipe = async (product: Product) => {
    setSelected(product)
    setLoadingRecipe(true)
    setShowExtraForm(false)
    setEditingExtra(null)
    try {
      const recipe = await getRecipeByProduct(product.id)
      setRecipeId(recipe.id)
      setItems(recipe.items.map((i) => ({ inventoryItemId: i.inventoryItemId, quantityRequired: i.quantityRequired })))
      setExtras(recipe.extras ?? [])
    } catch {
      setRecipeId(null)
      setItems([])
      setExtras([])
    } finally {
      setLoadingRecipe(false)
    }
  }

  const addItem = () => setItems([...items, { inventoryItemId: 0, quantityRequired: 0 }])
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i: number, key: keyof RecipeItemRequest, val: number) =>
    setItems(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item))

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

  const unitLabel = (id: number) => {
    const item = (inventory as InventoryItem[]).find((i) => i.id === id)
    if (!item) return ''
    return item.unitType === 'PIECE' ? 'pza' : item.unitType === 'GRAM' ? 'g' : 'ml'
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Recetas</h2>
      <p className="text-slate-500 text-sm">Configura insumos base y extras opcionales de cada producto.</p>

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
                    <div className="flex items-center gap-1 w-28">
                      <input type="number" step="0.001" value={item.quantityRequired}
                        onChange={(e) => updateItem(i, 'quantityRequired', parseFloat(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                        placeholder="0" />
                      <span className="text-xs text-slate-400 w-6 shrink-0">{unitLabel(item.inventoryItemId)}</span>
                    </div>
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
                    <input type="text" placeholder="Nombre del extra (ej: Cacahuates)"
                      value={extraForm.name} onChange={(e) => setExtraForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 block mb-0.5">Precio adicional $</label>
                        <input type="number" min={0} step="0.50" placeholder="0.00"
                          value={extraForm.extraPrice} onChange={(e) => setExtraForm(f => ({ ...f, extraPrice: e.target.value }))}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 block mb-0.5">Cantidad a descontar</label>
                        <input type="number" min={0} step="0.001" placeholder="0"
                          value={extraForm.quantityRequired} onChange={(e) => setExtraForm(f => ({ ...f, quantityRequired: e.target.value }))}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-0.5">Insumo a descontar</label>
                      <select value={extraForm.inventoryItemId || ''}
                        onChange={(e) => setExtraForm(f => ({ ...f, inventoryItemId: parseInt(e.target.value) }))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400">
                        <option value="">Seleccionar insumo</option>
                        {(inventory as InventoryItem[]).map((inv) => (
                          <option key={inv.id} value={inv.id}>{inv.name}</option>
                        ))}
                      </select>
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
    </div>
  )
}
