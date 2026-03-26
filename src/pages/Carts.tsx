import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCarts, createCart, updateCart, deleteCart, reactivateCart } from '../api/carts'
import { autoGenerate } from '../api/requisitions'
import type { Cart, CartRequest, CartCountStrategy, CartCountFrequency } from '../types'
import { Plus, Pencil, Trash2, X, MapPin, AlertTriangle, RotateCcw, Info, PackageCheck, ShieldCheck } from 'lucide-react'

const STRATEGY_LABELS: Record<CartCountStrategy, string> = {
  STRICT_REQUIRED: 'Apertura + Cierre obligatorios',
  CLOSING_ONLY: 'Solo cierre obligatorio',
  THRESHOLD_ALERT: 'Alerta por discrepancia',
  DISABLED: 'Sin conteo',
}
const STRATEGY_COLORS: Record<CartCountStrategy, string> = {
  STRICT_REQUIRED: 'bg-violet-100 text-violet-700',
  CLOSING_ONLY: 'bg-blue-100 text-blue-700',
  THRESHOLD_ALERT: 'bg-amber-100 text-amber-700',
  DISABLED: 'bg-slate-100 text-slate-500',
}
const FREQUENCY_LABELS: Record<CartCountFrequency, string> = {
  PER_SHIFT: 'Por turno',
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
}

export default function Carts() {
  const qc = useQueryClient()
  const { data: carts = [], isLoading } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const [modal, setModal] = useState<{ open: boolean; item?: Cart }>({ open: false })
  const [form, setForm] = useState<CartRequest>({ name: '', location: '' })
  const [deleteTarget, setDeleteTarget] = useState<Cart | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [newCart, setNewCart] = useState<Cart | null>(null)
  const [autoGenResult, setAutoGenResult] = useState<{ success: boolean; message: string } | null>(null)

  const openCreate = () => { setForm({ name: '', location: '', countStrategy: 'DISABLED', countFrequency: 'PER_SHIFT' }); setModal({ open: true }) }
  const openEdit = (c: Cart) => { setForm({ name: c.name, location: c.location, countStrategy: c.countStrategy ?? 'DISABLED', countFrequency: c.countFrequency ?? 'PER_SHIFT' }); setModal({ open: true, item: c }) }
  const close = () => setModal({ open: false })

  const saveMut = useMutation({
    mutationFn: () => modal.item ? updateCart(modal.item.id, form) : createCart(form),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['carts'] })
      close()
      if (!modal.item) {
        setNewCart(data)
        setAutoGenResult(null)
      }
    },
  })

  const autoGenMut = useMutation({
    mutationFn: (cartId: number) => autoGenerate(cartId),
    onSuccess: (data) => {
      setAutoGenResult({ success: true, message: `Requisición #${data.id} generada con ${data.items.length} insumo(s). Ve a Resurtidos para aprobarla y despacharla.` })
      qc.invalidateQueries({ queryKey: ['requisitions'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setAutoGenResult({ success: false, message: msg || 'No se pudo generar la requisición. Verifica que la bodega tenga insumos registrados.' })
    },
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
        <h2 className="text-xl font-bold text-slate-800">Puntos de Venta (PDV)</h2>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* ── Onboarding: primer carrito creado ────────────────────────────────── */}
      {newCart && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Info size={18} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-800 text-sm">PDV "{newCart.name}" creado</p>
              <p className="text-xs text-blue-700 mt-1">
                Para iniciar operaciones, el sistema puede generar automáticamente una
                requisición de resurtido con los insumos disponibles en bodega central.
                Si ya tienes stock registrado, el administrador podrá aprobarla y
                despacharla de inmediato para que el PDV quede listo para vender.
              </p>
              {autoGenResult ? (
                <div className={`mt-3 flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${
                  autoGenResult.success
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  {autoGenResult.success
                    ? <PackageCheck size={14} className="shrink-0 mt-0.5" />
                    : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
                  {autoGenResult.message}
                </div>
              ) : (
                <button
                  onClick={() => autoGenMut.mutate(newCart.id)}
                  disabled={autoGenMut.isPending}
                  className="mt-3 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                  {autoGenMut.isPending ? 'Generando...' : 'Generar requisición de inicio de operaciones'}
                </button>
              )}
            </div>
            <button onClick={() => { setNewCart(null); setAutoGenResult(null) }} className="shrink-0 text-blue-400 hover:text-blue-600">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                <MapPin size={12} /> {c.location}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <ShieldCheck size={11} className="text-slate-400" />
              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${STRATEGY_COLORS[c.countStrategy ?? 'DISABLED']}`}>
                {STRATEGY_LABELS[c.countStrategy ?? 'DISABLED']}
              </span>
            </div>
          </div>
        ))}
        {active.length === 0 && (
          <div className="col-span-full">
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 max-w-lg">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Agrega todos tus puntos de venta de una sola vez</p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  Si haces la carga incompleta el sistema no funcionará al 100%, ya que los PDVs son la base para calcular
                  reportes por ubicación, transferencias de inventario, análisis de consumo y cierres de turno.
                  Tómate unos minutos para agregar todos los que operas antes de continuar.
                </p>
              </div>
            </div>
          </div>
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
                <h3 className="font-bold text-slate-800">Desactivar PDV</h3>
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
              <h3 className="font-bold text-slate-800">{modal.item ? 'Editar PDV' : 'Nuevo PDV'}</h3>
              <button onClick={close}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nombre *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="PDV Norte" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Ubicación</label>
                <input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Parque Revolución" />
              </div>

              {/* ── Estrategia de conteo ─────────────────────────────────────── */}
              <div className="border-t border-slate-100 pt-4">
                <label className="text-sm font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-violet-500" /> Estrategia de conteo de inventario
                </label>
                <p className="text-xs text-slate-400 mb-2">Controla si el turno requiere conteo físico para cerrar.</p>
                <select value={form.countStrategy ?? 'DISABLED'}
                  onChange={(e) => setForm({ ...form, countStrategy: e.target.value as CartCountStrategy })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                  <option value="DISABLED">Sin conteo — solo seguimiento por receta</option>
                  <option value="CLOSING_ONLY">Solo cierre — empleado declara al cerrar turno</option>
                  <option value="STRICT_REQUIRED">Apertura + Cierre — máximo control (bloquea cierre)</option>
                  <option value="THRESHOLD_ALERT">Alerta por discrepancia — conteo opcional, alerta si hay diferencia</option>
                </select>
              </div>

              {form.countStrategy && form.countStrategy !== 'DISABLED' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Frecuencia de conteo</label>
                  <select value={form.countFrequency ?? 'PER_SHIFT'}
                    onChange={(e) => setForm({ ...form, countFrequency: e.target.value as CartCountFrequency })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                    <option value="PER_SHIFT">Por turno (cada apertura/cierre)</option>
                    <option value="DAILY">Diario (primer turno del día)</option>
                    <option value="WEEKLY">Semanal</option>
                  </select>
                </div>
              )}
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
