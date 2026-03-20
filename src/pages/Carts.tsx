import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCarts, createCart, updateCart, deleteCart, reactivateCart } from '../api/carts'
import type { Cart, CartRequest } from '../types'
import { Plus, Pencil, Trash2, X, MapPin, AlertTriangle, RotateCcw } from 'lucide-react'

export default function Carts() {
  const qc = useQueryClient()
  const { data: carts = [], isLoading } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const [modal, setModal] = useState<{ open: boolean; item?: Cart }>({ open: false })
  const [form, setForm] = useState<CartRequest>({ name: '', location: '' })
  const [deleteTarget, setDeleteTarget] = useState<Cart | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const openCreate = () => { setForm({ name: '', location: '' }); setModal({ open: true }) }
  const openEdit = (c: Cart) => { setForm({ name: c.name, location: c.location }); setModal({ open: true, item: c }) }
  const close = () => setModal({ open: false })

  const saveMut = useMutation({
    mutationFn: () => modal.item ? updateCart(modal.item.id, form) : createCart(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['carts'] }); close() },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCart(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['carts'] }); setDeleteTarget(null); setDeleteError('') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteError(msg || 'No se pudo desactivar el carrito')
    },
  })

  const reactivateMut = useMutation({
    mutationFn: (id: number) => reactivateCart(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carts'] }),
  })

  const active = carts.filter((c) => c.active)
  const inactive = carts.filter((c) => !c.active)

  if (isLoading) return <div className="text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Carritos / Puntos de venta</h2>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* ── Activos ──────────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="font-semibold text-slate-800">{c.name}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-violet-600">
                  <Pencil size={15} />
                </button>
                <button onClick={() => { setDeleteError(''); setDeleteTarget(c) }} className="text-slate-400 hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            {c.location && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <MapPin size={12} /> {c.location}
              </div>
            )}
          </div>
        ))}
        {active.length === 0 && (
          <p className="text-slate-400 text-sm col-span-full py-8 text-center">
            No hay carritos activos. Crea uno para empezar a registrar ventas.
          </p>
        )}
      </div>

      {/* ── Inactivos ─────────────────────────────────────────────────────────── */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Desactivados</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inactive.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 opacity-50">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-slate-500 line-through">{c.name}</p>
                  <button
                    onClick={() => reactivateMut.mutate(c.id)}
                    disabled={reactivateMut.isPending}
                    title="Reactivar"
                    className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 disabled:opacity-50 transition-colors">
                    <RotateCcw size={13} /> Reactivar
                  </button>
                </div>
                {c.location && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin size={12} /> {c.location}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Confirmar desactivación ───────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Desactivar carrito</h3>
                <p className="text-sm text-slate-500">Podrás reactivarlo después si lo necesitas.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-4">
              ¿Desactivar <span className="font-semibold">"{deleteTarget.name}"</span>?
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
                {deleteMut.isPending ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Crear / Editar ────────────────────────────────────────────────────── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">{modal.item ? 'Editar carrito' : 'Nuevo carrito'}</h3>
              <button onClick={close}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nombre *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Carrito 1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Ubicación</label>
                <input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Parque Revolución" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={close}
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
    </div>
  )
}
