import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api/products'
import { getCategories } from '../api/products'
import type { Product, ProductRequest } from '../types'
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'

export default function Products() {
  const qc = useQueryClient()
  const { data: products = [], isLoading } = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories })

  const [modal, setModal] = useState<{ open: boolean; item?: Product }>({ open: false })
  const [form, setForm] = useState<ProductRequest>({ name: '', salePrice: 0 })
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  const openCreate = () => { setForm({ name: '', salePrice: 0 }); setModal({ open: true }) }
  const openEdit = (p: Product) => {
    setForm({ name: p.name, description: p.description, salePrice: p.salePrice, categoryId: p.categoryId })
    setModal({ open: true, item: p })
  }
  const close = () => setModal({ open: false })

  const saveMut = useMutation({
    mutationFn: () => modal.item ? updateProduct(modal.item.id, form) : createProduct(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); close() },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setDeleteTarget(null) },
  })

  if (isLoading) return <div className="text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Productos</h2>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {products.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No hay productos. Crea uno para empezar.
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
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {p.categoryName || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                    ${p.salePrice.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-violet-600">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Confirmar eliminación ─────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Eliminar producto</h3>
                <p className="text-sm text-slate-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-5">
              ¿Eliminar <span className="font-semibold">"{deleteTarget.name}"</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
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
