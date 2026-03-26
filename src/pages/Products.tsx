import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProducts, getInactiveProducts, getAllProducts, createProduct, updateProduct, deleteProduct, reactivateProduct } from '../api/products'
import { getCategories } from '../api/products'
import { getRecipeByProduct } from '../api/recipes'
import type { Product, ProductRequest } from '../types'
import { Plus, Pencil, Trash2, X, AlertTriangle, BookOpen, EyeOff, RotateCcw, Archive } from 'lucide-react'

export default function Products() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('active')

  const { data: activeProducts = [], isLoading: loadingActive } = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const { data: inactiveProducts = [], isLoading: loadingInactive } = useQuery({ queryKey: ['products-inactive'], queryFn: getInactiveProducts, enabled: filter === 'inactive' })
  const { data: allProducts = [], isLoading: loadingAll } = useQuery({ queryKey: ['products-all'], queryFn: getAllProducts, enabled: filter === 'all' })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories })

  const products = filter === 'inactive' ? inactiveProducts : filter === 'all' ? allProducts : activeProducts
  const isLoading = filter === 'inactive' ? loadingInactive : filter === 'all' ? loadingAll : loadingActive

  const [modal, setModal] = useState<{ open: boolean; item?: Product }>({ open: false })
  const [form, setForm] = useState<ProductRequest>({ name: '', salePrice: 0 })
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<Product | null>(null)

  const openCreate = () => { setForm({ name: '', salePrice: 0 }); setModal({ open: true }) }
  const openEdit = (p: Product) => {
    setForm({ name: p.name, description: p.description, salePrice: p.salePrice, categoryId: p.categoryId })
    setModal({ open: true, item: p })
  }
  const close = () => setModal({ open: false })

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['products-inactive'] })
    qc.invalidateQueries({ queryKey: ['products-all'] })
  }

  const saveMut = useMutation({
    mutationFn: () => modal.item ? updateProduct(modal.item.id, form) : createProduct(form),
    onSuccess: () => { invalidateAll(); close() },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => { invalidateAll(); setDeleteTarget(null) },
  })

  const reactivateMut = useMutation({
    mutationFn: (id: number) => reactivateProduct(id),
    onSuccess: () => { invalidateAll(); setReactivateTarget(null) },
  })

  if (isLoading && products.length === 0) return <div className="text-slate-400 text-sm">Cargando...</div>

  const noCategories = categories.length === 0

  return (
    <div className="space-y-4">
      {noCategories && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">No hay categorías registradas</p>
            <p className="text-sm text-red-600 mt-0.5">
              Los productos se agrupan en categorías para mayor control y trazabilidad en reportes.
              Agrega al menos una categoría antes de crear productos.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-slate-800">Productos</h2>
        <div className="flex items-center gap-2">
          {/* Segmented filter */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {(['active', 'inactive', 'all'] as const).map((f) => {
              const labels = { active: 'Activos', inactive: 'Inactivos', all: 'Todos' }
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 transition-colors ${
                    filter === f
                      ? 'bg-violet-600 text-white font-medium'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {labels[f]}
                </button>
              )
            })}
          </div>
          {filter === 'active' && (
            <button
              onClick={openCreate}
              disabled={noCategories}
              title={noCategories ? 'Agrega una categoría primero' : undefined}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus size={16} /> Nuevo
            </button>
          )}
        </div>
      </div>

      {filter === 'inactive' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <Archive size={13} className="shrink-0" />
          Mostrando productos desactivados. Puedes reactivarlos para que vuelvan al punto de venta.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {products.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {filter === 'inactive' ? 'No hay productos desactivados.' : filter === 'all' ? 'No hay productos.' : 'No hay productos. Crea uno para empezar.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Categoría</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Precio</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const inactive = !p.active
                return (
                  <tr key={p.id} className={inactive ? 'opacity-60 hover:opacity-80' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {p.name}
                      {inactive && <span className="ml-2 text-xs text-amber-600 font-normal">(inactivo)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{p.categoryName || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">${p.salePrice.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {inactive ? (
                          <button
                            onClick={() => setReactivateTarget(p)}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium border border-green-300 hover:border-green-400 px-2 py-1 rounded-lg transition-colors"
                          >
                            <RotateCcw size={12} /> Reactivar
                          </button>
                        ) : (
                          <>
                            <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-violet-600">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => setDeleteTarget(p)} className="text-slate-400 hover:text-red-500">
                              <Trash2 size={15} />
                            </button>
                          </>
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

      {/* ── Confirmar desactivación ───────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirmModal
          product={deleteTarget}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteMut.isPending}
        />
      )}

      {/* ── Confirmar reactivación ────────────────────────────────────────────── */}
      {reactivateTarget && (
        <ReactivateConfirmModal
          product={reactivateTarget}
          onConfirm={() => reactivateMut.mutate(reactivateTarget.id)}
          onCancel={() => setReactivateTarget(null)}
          isPending={reactivateMut.isPending}
        />
      )}

      {/* ── Crear / Editar ────────────────────────────────────────────────────── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">{modal.item ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button onClick={close} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nombre *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Esquite Chico" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Descripción</label>
                <input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Opcional" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Precio de venta *</label>
                <input type="number" step="0.01" value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="35.00" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Categoría</label>
                <select value={form.categoryId || ''}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={close}
                className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !form.name}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                {saveMut.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal de confirmación de desactivación ────────────────────────────────────

function DeleteConfirmModal({ product, onConfirm, onCancel, isPending }: {
  product: Product
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  const { data: recipe, isLoading: recipeLoading } = useQuery({
    queryKey: ['recipe', product.id],
    queryFn: () => getRecipeByProduct(product.id),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const hasRecipe = !!recipe

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${hasRecipe ? 'bg-orange-100' : 'bg-amber-100'}`}>
            {hasRecipe
              ? <AlertTriangle size={18} className="text-orange-500" />
              : <EyeOff size={18} className="text-amber-500" />
            }
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Desactivar producto</h3>
            <p className="text-xs text-slate-500">
              El producto desaparece del punto de venta pero{' '}
              <span className="font-medium text-slate-600">el historial de ventas se conserva intacto.</span>
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-700">
            ¿Desactivar <span className="font-semibold">"{product.name}"</span>?
          </p>

          {/* Advertencia si tiene receta */}
          {!recipeLoading && hasRecipe && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-2 text-orange-700 font-semibold text-sm">
                <BookOpen size={14} className="shrink-0" />
                Este producto tiene una receta asociada
              </div>
              <p className="text-xs text-orange-600 leading-relaxed">
                La receta queda en pausa mientras el producto esté desactivado.
                <span className="font-semibold"> Si lo reactivas, la receta vuelve tal cual — sin perder nada.</span>
              </p>
            </div>
          )}

          {/* Nota sobre integridad histórica */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="font-medium text-slate-600">Los reportes y ventas anteriores no se ven afectados.</span>{' '}
              El registro existe en la base de datos — solo se oculta del catálogo activo y del punto de venta.
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 border border-slate-300 text-slate-700 text-sm py-3 rounded-xl active:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || recipeLoading}
            className={`flex-1 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl ${
              hasRecipe
                ? 'bg-orange-500 active:bg-orange-600'
                : 'bg-amber-500 active:bg-amber-600'
            }`}
          >
            {isPending ? 'Desactivando...' : 'Sí, desactivar'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Modal de confirmación de reactivación ─────────────────────────────────────

function ReactivateConfirmModal({ product, onConfirm, onCancel, isPending }: {
  product: Product
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  const { data: recipe, isLoading: recipeLoading } = useQuery({
    queryKey: ['recipe', product.id],
    queryFn: () => getRecipeByProduct(product.id),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const hasRecipe = !!recipe

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">

        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <RotateCcw size={18} className="text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Reactivar producto</h3>
            <p className="text-xs text-slate-500">Volverá a aparecer en el punto de venta.</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-700">
            ¿Reactivar <span className="font-semibold">"{product.name}"</span>?
          </p>

          {!recipeLoading && hasRecipe && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
              <BookOpen size={14} className="text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700 leading-relaxed">
                La receta asociada se recupera automáticamente —
                <span className="font-semibold"> ingredientes e insumos quedan exactamente como estaban.</span>
              </p>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              El producto aparecerá de nuevo en el catálogo y en el punto de venta de inmediato.
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 border border-slate-300 text-slate-700 text-sm py-3 rounded-xl active:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || recipeLoading}
            className="flex-1 bg-green-600 active:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl"
          >
            {isPending ? 'Reactivando...' : 'Sí, reactivar'}
          </button>
        </div>

      </div>
    </div>
  )
}
