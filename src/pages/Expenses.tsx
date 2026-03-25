import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getExpenses, createExpense, updateExpense, deleteExpense,
  type ExpenseResponse, type ExpenseRequest,
} from '../api/expenses'
import { getCarts } from '../api/carts'
import { getTenantProfile } from '../api/tenant'
import { TrendingDown, Plus, Pencil, Trash2, X, Warehouse } from 'lucide-react'

const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const CATEGORIES = ['Renta', 'Servicios', 'Cuotas', 'Mantenimiento', 'Transporte', 'Otro']

const today = () => new Date().toISOString().slice(0, 10)

function currentMonthBounds() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
  return { min: `${y}-${m}-01`, max: `${y}-${m}-${lastDay}` }
}
const { min: dateMin, max: dateMax } = currentMonthBounds()

const emptyForm = (): ExpenseRequest => ({
  date: today(),
  amount: 0,
  description: '',
  category: '',
  notes: '',
  cartId: undefined,
})

export default function Expenses() {
  const qc = useQueryClient()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // Filtro de listado: undefined = todos | 0 = solo generales | N = carrito específico
  const [filterCartId, setFilterCartId] = useState<number | undefined>(undefined)

  const [showForm, setShowForm]         = useState(false)
  const [editTarget, setEditTarget]     = useState<ExpenseResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ExpenseResponse | null>(null)
  const [form, setForm]                 = useState<ExpenseRequest>(emptyForm())
  const [formError, setFormError]       = useState<string | null>(null)

  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const { data: tenant }    = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile })

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', year, month, filterCartId],
    queryFn: () => getExpenses(year, month, filterCartId),
  })

  // Límites basados en la fecha de registro del negocio
  const registeredAt  = tenant ? new Date(tenant.createdAt) : new Date(now.getFullYear(), 0, 1)
  const minYear       = registeredAt.getFullYear()
  const minMonthOfMin = registeredAt.getMonth() + 1
  const maxYear       = now.getFullYear()
  const maxMonthOfMax = now.getMonth() + 1

  const availableYears = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)

  const availableMonths = MONTH_NAMES.map((name, i) => {
    const m = i + 1
    if (year === minYear && m < minMonthOfMin) return null
    if (year === maxYear && m > maxMonthOfMax) return null
    return { value: m, label: name }
  }).filter(Boolean) as { value: number; label: string }[]

  const handleYearChange = (newYear: number) => {
    setYear(newYear)
    const minM = newYear === minYear ? minMonthOfMin : 1
    const maxM = newYear === maxYear ? maxMonthOfMax : 12
    if (month < minM) setMonth(minM)
    else if (month > maxM) setMonth(maxM)
  }

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0)

  const saveMut = useMutation({
    mutationFn: () =>
      editTarget
        ? updateExpense(editTarget.id, form)
        : createExpense(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      closeForm()
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message ?? 'Error al guardar el gasto.')
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteExpense(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setDeleteTarget(null)
    },
  })

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyForm())
    setFormError(null)
    setShowForm(true)
  }

  const openEdit = (e: ExpenseResponse) => {
    setEditTarget(e)
    setForm({
      date: e.date,
      amount: e.amount,
      description: e.description,
      category: e.category ?? '',
      notes: e.notes ?? '',
      cartId: e.cartId,
    })
    setFormError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditTarget(null)
    setFormError(null)
  }

  const isPastDate = form.date < today()

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    setFormError(null)
    if (!form.description.trim()) { setFormError('La descripción es requerida.'); return }
    if (!form.amount || form.amount <= 0) { setFormError('El monto debe ser mayor a cero.'); return }
    if (isPastDate && !form.notes?.trim()) {
      setFormError('La fecha es anterior a hoy — las notas con el motivo detallado son obligatorias.')
      return
    }
    saveMut.mutate()
  }

  // Agrupación por categoría para el resumen
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    const key = e.category || 'Sin categoría'
    acc[key] = (acc[key] ?? 0) + e.amount
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingDown size={20} className="text-orange-500" />
          <h2 className="text-xl font-bold text-slate-800">Gastos operativos</h2>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Agregar gasto
        </button>
      </div>

      {/* Controles: selectores de mes/año + filtro de carrito */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-orange-400"
        >
          {availableMonths.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-orange-400"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Filtro por punto de venta */}
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1 flex items-center gap-1">
            <Warehouse size={10} /> Filtrar por
          </label>
          <select
            value={filterCartId === undefined ? '' : filterCartId}
            onChange={(e) => {
              const val = e.target.value
              if (val === '') setFilterCartId(undefined)
              else setFilterCartId(Number(val))
            }}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos los gastos</option>
            <option value="0">Solo generales (sin PDV)</option>
            {carts.filter((c) => c.active).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {!isLoading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Total gastos del periodo</p>
            <p className="text-xl font-bold text-orange-700">{fmt(totalExpenses)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{expenses.length} registro{expenses.length !== 1 ? 's' : ''}</p>
          </div>
          {Object.keys(byCategory).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">Por categoría</p>
              <div className="space-y-1">
                {Object.entries(byCategory).map(([cat, total]) => (
                  <div key={cat} className="flex justify-between text-xs">
                    <span className="text-slate-600 truncate">{cat}</span>
                    <span className="font-semibold text-slate-700 ml-2">{fmt(total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">
          Sin gastos registrados en {MONTH_NAMES[month - 1]} {year}.
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800 text-sm">{e.description}</span>
                  {e.category && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{e.category}</span>
                  )}
                  {e.cartName
                    ? <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Warehouse size={10} />{e.cartName}</span>
                    : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">General</span>
                  }
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs text-slate-400">
                    {new Date(e.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {e.createdByName && (
                    <span className="text-xs text-slate-400">Registrado por <span className="font-medium text-slate-500">{e.createdByName}</span></span>
                  )}
                  {e.notes && <span className="text-xs text-slate-400 truncate">{e.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-orange-700 whitespace-nowrap">{fmt(e.amount)}</span>
                <button onClick={() => openEdit(e)} className="text-slate-400 hover:text-violet-600 transition-colors">
                  <Pencil size={15} />
                </button>
                <button onClick={() => setDeleteTarget(e)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                {editTarget ? 'Editar gasto' : 'Nuevo gasto operativo'}
              </h3>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
                  <input type="date" value={form.date}
                    min={dateMin} max={dateMax}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Monto (MXN)</label>
                  <input type="number" step="0.01" min="0.01" value={form.amount || ''}
                    onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                    placeholder="0.00"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Descripción</label>
                <input type="text" value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="ej. Recibo de luz, Renta local..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Punto de venta */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1 flex items-center gap-1">
                  <Warehouse size={10} /> Punto de venta
                </label>
                <select
                  value={form.cartId ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, cartId: e.target.value ? Number(e.target.value) : undefined }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">Negocio en general</option>
                  {carts.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Déjalo en "Negocio en general" si el gasto aplica a toda la operación.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Categoría (opcional)</label>
                <select value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                  <option value="">Sin categoría</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">
                  Notas
                  {isPastDate
                    ? <span className="text-red-500 ml-1">* requeridas (fecha anterior a hoy)</span>
                    : <span className="text-slate-400 ml-1">(opcional)</span>
                  }
                </label>
                <input type="text" value={form.notes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={isPastDate ? 'Explica el motivo de registrar este gasto con fecha pasada...' : 'Detalles adicionales...'}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                    isPastDate ? 'border-amber-400 focus:border-amber-500 bg-amber-50' : 'border-slate-300 focus:border-violet-500'
                  }`}
                />
              </div>

              {formError && <p className="text-red-500 text-sm">{formError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeForm}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMut.isPending}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50">
                  {saveMut.isPending ? 'Guardando...' : editTarget ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Eliminar gasto</h3>
            <p className="text-sm text-slate-600">
              ¿Confirmas que deseas eliminar <strong>{deleteTarget.description}</strong> ({fmt(deleteTarget.amount)})?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50">
                {deleteMut.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
