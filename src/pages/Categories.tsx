import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/products'
import type { Category } from '../types'
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'

export default function Categories() {
  const qc = useQueryClient()
  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const [modal, setModal] = useState<{ open: boolean; item?: Category }>({ open: false })
  const [name, setName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const openCreate = () => { setName(''); setModal({ open: true }) }
  const openEdit = (c: Category) => { setName(c.name); setModal({ open: true, item: c }) }
  const close = () => setModal({ open: false })

  const openDeleteConfirm = (c: Category) => { setDeleteError(''); setDeleteTarget(c) }
  const closeDeleteConfirm = () => { setDeleteTarget(null); setDeleteError('') }

  const saveMut = useMutation({
    mutationFn: () => modal.item ? updateCategory(modal.item.id, { name }) : createCategory({ name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); close() },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); closeDeleteConfirm() },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteError(msg || 'No se pudo eliminar la categoría')
    },
  })

  if (isLoading) return <div className="text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Categorías de productos</h2>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nueva
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No hay categorías aún.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <span className="font-medium text-slate-800 text-sm">{c.name}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-violet-600">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => openDeleteConfirm(c)} className="text-slate-400 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Crear / Editar ────────────────────────────────────────────────────── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">{modal.item ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <button onClick={close}><X size={20} className="text-slate-400" /></button>
            </div>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Esquites, Elotes, Bebidas..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 mb-5"
            />
            <div className="flex gap-3">
              <button onClick={close} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={() => saveMut.mutate()} disabled={!name || saveMut.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {saveMut.isPending ? 'Guardando...' : 'Guardar'}
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
                <h3 className="font-bold text-slate-800">Eliminar categoría</h3>
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
              <button onClick={closeDeleteConfirm}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {deleteMut.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
