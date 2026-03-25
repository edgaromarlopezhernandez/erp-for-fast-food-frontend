import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateEmployee, deactivateUser, reactivateUser, assignCart } from '../api/users'
import type { DeactivationResponse } from '../api/users'
import { getCarts } from '../api/carts'
import type { UserRequest, UserRole, UserResponse, PayrollPeriod } from '../types'
import {
  Plus, UserX, UserCheck, X, ShieldCheck, Warehouse,
  DollarSign, Bell, Pencil, ChevronDown, ChevronUp, Crown, AlertTriangle,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:      'Admin',
  MANAGER:    'Gerente',
  SUPERVISOR: 'Supervisor',
  CASHIER:    'Cajero',
  COOK:       'Cocinero',
}
const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:      'bg-violet-100 text-violet-700',
  MANAGER:    'bg-blue-100 text-blue-700',
  SUPERVISOR: 'bg-cyan-100 text-cyan-700',
  CASHIER:    'bg-green-100 text-green-700',
  COOK:       'bg-orange-100 text-orange-700',
}
const PERIOD_LABELS: Record<PayrollPeriod, string> = {
  BIWEEKLY: 'Quincenal (días 1 y 16)',
  WEEKLY:   'Semanal (lunes)',
  MONTHLY:  'Mensual (día 1)',
}
const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const emptyForm = (): UserRequest => ({
  name: '', username: '', password: '', role: 'CASHIER',
})

// ── Section toggle helper ─────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide"
      >
        {title}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && <div className="p-3 space-y-3">{children}</div>}
    </div>
  )
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500'

// ── Employee Form Modal ───────────────────────────────────────────────────────
function EmployeeFormModal({
  title, initial, carts, isEdit, onSave, onClose, isPending, error,
}: {
  title: string
  initial: UserRequest
  carts: { id: number; name: string; location?: string }[]
  isEdit: boolean
  onSave: (f: UserRequest) => void
  onClose: () => void
  isPending: boolean
  error: string
}) {
  const [form, setForm] = useState<UserRequest>(initial)
  const set = (patch: Partial<UserRequest>) => setForm((f) => ({ ...f, ...patch }))

  const canSave = form.name.trim() !== '' &&
    form.username.trim() !== '' &&
    (!isEdit || true) &&                      // password optional on edit
    (isEdit || (form.password ?? '').trim() !== '')  // required on create

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Acceso */}
          <Section title="Acceso al sistema">
            {/* En creación siempre visible; en edición solo si el rol ya es ADMIN */}
            {(!isEdit || form.role === 'ADMIN') && (
              <button
                type="button"
                onClick={() => {
                  const owner = !form.isOwner
                  if (isEdit) {
                    set({ isOwner: owner })
                  } else {
                    set({ isOwner: owner, role: owner ? 'ADMIN' : 'CASHIER', cartId: undefined })
                  }
                }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border-2 transition-colors text-left ${
                  form.isOwner
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Toggle visual */}
                <div className={`w-9 h-5 rounded-full flex items-center transition-colors shrink-0 ${
                  form.isOwner ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
                }`}>
                  <div className="w-4 h-4 rounded-full bg-white shadow mx-0.5" />
                </div>
                <Crown size={15} className={form.isOwner ? 'text-amber-500' : 'text-slate-400'} />
                <div>
                  <span className={`text-sm font-medium ${form.isOwner ? 'text-amber-700' : 'text-slate-600'}`}>
                    Propietario del negocio
                  </span>
                  <span className="ml-2 text-xs text-slate-400">(sin nómina)</span>
                </div>
                <span className={`ml-auto text-xs font-semibold ${form.isOwner ? 'text-amber-600' : 'text-slate-400'}`}>
                  {form.isOwner ? 'Activo' : 'No'}
                </span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre de pantalla *">
                <input value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} placeholder="Juan" />
              </Field>
              <Field label="Usuario *">
                <input value={form.username} onChange={(e) => set({ username: e.target.value })}
                  className={inputCls} placeholder="juanr" disabled={isEdit} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={isEdit ? 'Nueva contraseña (dejar en blanco = no cambia)' : 'Contraseña *'}>
                <input type="password" value={form.password ?? ''}
                  onChange={(e) => set({ password: e.target.value })} className={inputCls} />
              </Field>
              {isEdit ? (
                <Field label="Rol">
                  <div className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium w-full ${ROLE_COLORS[form.role]}`}>
                    {ROLE_LABELS[form.role]}
                    <span className="ml-2 text-xs font-normal opacity-60">(no se puede cambiar)</span>
                  </div>
                </Field>
              ) : !form.isOwner ? (
                <Field label="Rol">
                  <select value={form.role}
                    onChange={(e) => set({ role: e.target.value as UserRole, cartId: undefined })}
                    className={inputCls}>
                    <option value="CASHIER">Cajero</option>
                    <option value="SUPERVISOR">Supervisor (encargado de punto)</option>
                    <option value="COOK">Cocinero</option>
                    <option value="MANAGER">Gerente</option>
                    <option value="ADMIN">Admin empleado</option>
                  </select>
                </Field>
              ) : null}
            </div>
            {(form.role === 'CASHIER' || form.role === 'SUPERVISOR') && !form.isOwner && (
              <Field label="PDV asignado">
                <select value={form.cartId ?? ''} onChange={(e) => set({ cartId: e.target.value ? Number(e.target.value) : undefined })} className={inputCls}>
                  <option value="">— Sin asignar —</option>
                  {carts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.location ? ` (${c.location})` : ''}</option>)}
                </select>
              </Field>
            )}
          </Section>

          {/* Datos personales */}
          <Section title="Datos personales" defaultOpen={isEdit}>
            <Field label="Nombre completo legal">
              <input value={form.fullName ?? ''} onChange={(e) => set({ fullName: e.target.value })}
                className={inputCls} placeholder="Juan Rodríguez García" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teléfono">
                <input value={form.phone ?? ''} onChange={(e) => set({ phone: e.target.value })}
                  className={inputCls} placeholder="55 1234 5678" />
              </Field>
              <Field label="Puesto (RH)">
                <input value={form.position ?? ''} onChange={(e) => set({ position: e.target.value })}
                  className={inputCls} placeholder="ej. Cajero Turno Mañana" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha de contratación">
                <input type="date" value={form.hireDate ?? ''} onChange={(e) => set({ hireDate: e.target.value || undefined })} className={inputCls} />
              </Field>
              <Field label="CURP / RFC">
                <input value={form.curp ?? ''} onChange={(e) => set({ curp: e.target.value })}
                  className={inputCls} placeholder="AAAA000000XXXXXX00" />
              </Field>
            </div>
            <Field label="Cuenta bancaria (CLABE / número)">
              <input value={form.bankAccount ?? ''} onChange={(e) => set({ bankAccount: e.target.value })}
                className={inputCls} placeholder="CLABE 18 dígitos" />
            </Field>
          </Section>

          {/* Contacto de emergencia */}
          <Section title="Contacto de emergencia" defaultOpen={isEdit}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre">
                <input value={form.emergencyContact ?? ''} onChange={(e) => set({ emergencyContact: e.target.value })}
                  className={inputCls} placeholder="Nombre del contacto" />
              </Field>
              <Field label="Teléfono">
                <input value={form.emergencyPhone ?? ''} onChange={(e) => set({ emergencyPhone: e.target.value })}
                  className={inputCls} placeholder="55 9876 5432" />
              </Field>
            </div>
          </Section>

          {/* Nómina */}
          <Section title="Nómina" defaultOpen>
            {form.isOwner ? (
              <p className="text-xs text-slate-400 italic">El propietario no tiene nómina asociada.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sueldo por periodo $">
                  <input type="number" step="0.01" value={form.salary ?? ''}
                    onChange={(e) => set({ salary: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="0.00" className={inputCls} />
                </Field>
                <Field label="Periodo de pago">
                  <select value={form.payrollPeriod ?? ''} onChange={(e) => set({ payrollPeriod: e.target.value as PayrollPeriod || undefined })} className={inputCls}>
                    <option value="">— Sin definir —</option>
                    <option value="BIWEEKLY">Quincenal</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensual</option>
                  </select>
                </Field>
                <Field label="Día de descanso">
                  <select value={form.restDay ?? ''} onChange={(e) => set({ restDay: e.target.value || undefined })} className={inputCls}>
                    <option value="">Rotativo (1 día / semana sin día fijo)</option>
                    <option value="MONDAY">Lunes</option>
                    <option value="TUESDAY">Martes</option>
                    <option value="WEDNESDAY">Miércoles</option>
                    <option value="THURSDAY">Jueves</option>
                    <option value="FRIDAY">Viernes</option>
                    <option value="SATURDAY">Sábado</option>
                    <option value="SUNDAY">Domingo</option>
                  </select>
                </Field>
              </div>
            )}
          </Section>

          {/* Notas RH */}
          <Section title="Notas internas RH" defaultOpen={false}>
            <textarea value={form.hrNotes ?? ''} onChange={(e) => set({ hrNotes: e.target.value })}
              rows={3} placeholder="Observaciones internas..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" />
          </Section>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={() => onSave(form)} disabled={!canSave || isPending}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear empleado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Users() {
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserResponse | null>(null)
  const [cartModal, setCartModal]   = useState<UserResponse | null>(null)
  const [selectedCartId, setSelectedCartId] = useState<string>('')
  const [formError, setFormError]   = useState('')
  const [deactivateTarget, setDeactivateTarget] = useState<UserResponse | null>(null)
  const [deactivateError, setDeactivateError]   = useState('')
  const [deactivateResult, setDeactivateResult] = useState<DeactivationResponse | null>(null)

  const createMut = useMutation({
    mutationFn: (f: UserRequest) => createUser(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setCreateOpen(false); setFormError('') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setFormError(msg || 'Error al crear empleado')
    },
  })

  const updateMut = useMutation({
    mutationFn: (f: UserRequest) => updateEmployee(editTarget!.id, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditTarget(null); setFormError('') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setFormError(msg || 'Error al actualizar empleado')
    },
  })

  const deactivateMut = useMutation({
    mutationFn: (id: number) => deactivateUser(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setDeactivateTarget(null)
      setDeactivateError('')
      setDeactivateResult(result)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeactivateError(msg || 'No se pudo dar de baja al empleado')
    },
  })

  const reactivateMut = useMutation({
    mutationFn: reactivateUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const assignCartMut = useMutation({
    mutationFn: () => assignCart(cartModal!.id, selectedCartId ? Number(selectedCartId) : null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setCartModal(null) },
  })

  const openEdit = (u: UserResponse) => {
    setFormError('')
    setEditTarget(u)
  }

  const openCartModal = (u: UserResponse) => {
    setSelectedCartId(u.cartId?.toString() ?? '')
    setCartModal(u)
  }

  if (isLoading) return <div className="text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Empleados</h2>
        <button
          onClick={() => { setFormError(''); setCreateOpen(true) }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Nuevo empleado
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No hay empleados.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className={`flex items-center justify-between px-4 py-3 ${!u.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-sm">
                      {u.name[0].toUpperCase()}
                    </div>
                    {u.payrollDueToday && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" title="Nómina hoy" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm">{u.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-slate-400">@{u.username}</p>
                      {u.position && <p className="text-xs text-slate-400">· {u.position}</p>}
                      {u.hireDate && (
                        <p className="text-xs text-slate-400">
                          · desde {new Date(u.hireDate + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      {u.role === 'CASHIER' && (
                        <button onClick={() => openCartModal(u)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-600 transition-colors">
                          <Warehouse size={10} />
                          {u.cartName
                            ? <span className="text-violet-600 font-medium">{u.cartName}</span>
                            : <span className="italic">Sin PDV</span>}
                        </button>
                      )}
                      {u.salary && (
                        <span className={`flex items-center gap-1 text-xs ${u.payrollDueToday ? 'text-amber-600 font-medium' : 'text-green-600'}`}>
                          <DollarSign size={10} />
                          {fmt(u.salary)} · {u.payrollPeriod ? PERIOD_LABELS[u.payrollPeriod] : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {u.payrollDueToday && (
                    <span className="hidden sm:flex items-center gap-1 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                      <Bell size={10} /> Nómina hoy
                    </span>
                  )}
                  {u.isOwner && (
                    <span className="hidden sm:flex items-center gap-1 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                      <Crown size={10} /> Propietario
                    </span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                  <button onClick={() => openEdit(u)} title="Editar"
                    className="text-slate-400 hover:text-violet-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                  {u.active
                    ? <button onClick={() => { setDeactivateError(''); setDeactivateTarget(u) }} title="Dar de baja"
                        className="text-slate-400 hover:text-red-500 transition-colors">
                        <UserX size={15} />
                      </button>
                    : <button onClick={() => reactivateMut.mutate(u.id)} title="Reactivar"
                        className="text-slate-400 hover:text-green-600 transition-colors">
                        <UserCheck size={15} />
                      </button>
                  }
                  {u.role === 'ADMIN' && !u.isOwner && <ShieldCheck size={15} className="text-violet-400" />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Crear ────────────────────────────────────────────────────────────── */}
      {createOpen && (
        <EmployeeFormModal
          title="Nuevo empleado"
          initial={emptyForm()}
          carts={carts}
          isEdit={false}
          onSave={(f) => createMut.mutate(f)}
          onClose={() => setCreateOpen(false)}
          isPending={createMut.isPending}
          error={formError}
        />
      )}

      {/* ── Editar ───────────────────────────────────────────────────────────── */}
      {editTarget && (
        <EmployeeFormModal
          title={`Editar — ${editTarget.name}`}
          initial={{
            name: editTarget.name,
            username: editTarget.username,
            password: '',
            role: editTarget.role,
            cartId: editTarget.cartId,
            fullName: editTarget.fullName,
            phone: editTarget.phone,
            position: editTarget.position,
            hireDate: editTarget.hireDate,
            emergencyContact: editTarget.emergencyContact,
            emergencyPhone: editTarget.emergencyPhone,
            bankAccount: editTarget.bankAccount,
            curp: editTarget.curp,
            hrNotes: editTarget.hrNotes,
            salary: editTarget.salary,
            payrollPeriod: editTarget.payrollPeriod,
            restDay: editTarget.restDay,
            isOwner: editTarget.isOwner,
          }}
          carts={carts}
          isEdit={true}
          onSave={(f) => updateMut.mutate(f)}
          onClose={() => setEditTarget(null)}
          isPending={updateMut.isPending}
          error={formError}
        />
      )}

      {/* ── Confirmar baja ───────────────────────────────────────────────── */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <UserX size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Dar de baja</h3>
                <p className="text-sm text-slate-500">El empleado quedará inactivo en el sistema.</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 mb-3">
              ¿Dar de baja a <span className="font-semibold">{deactivateTarget.name}</span>?
            </p>

            {/* Aviso carrito asignado */}
            {deactivateTarget.cartId && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2 rounded-lg mb-3">
                <Warehouse size={14} className="mt-0.5 shrink-0" />
                <span>Está asignado al PDV <strong>{deactivateTarget.cartName}</strong>. Desasígnalo primero en la pestaña de empleados.</span>
              </div>
            )}

            {/* Aviso corte de nómina */}
            {!deactivateTarget.cartId && deactivateTarget.salary && !deactivateTarget.isOwner && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm px-3 py-2 rounded-lg mb-3">
                <DollarSign size={14} className="mt-0.5 shrink-0" />
                <span>Se registrará automáticamente un <strong>corte de nómina proporcional</strong> hasta el día de hoy basado en turnos aprobados.</span>
              </div>
            )}

            {/* Error del backend */}
            {deactivateError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {deactivateError}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button onClick={() => { setDeactivateTarget(null); setDeactivateError('') }}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => deactivateMut.mutate(deactivateTarget.id)}
                disabled={deactivateMut.isPending || !!deactivateTarget.cartId}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {deactivateMut.isPending ? 'Procesando...' : 'Sí, dar de baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resultado de baja con corte de nómina ──────────────────────── */}
      {deactivateResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <UserX size={18} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Baja registrada</h3>
                <p className="text-sm text-slate-500">{deactivateResult.user.name} fue dado de baja.</p>
              </div>
            </div>
            {deactivateResult.payrollCutAmount !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs text-blue-500 font-medium mb-1">Corte de nómina registrado</p>
                <p className="text-xl font-bold text-blue-700">
                  {deactivateResult.payrollCutAmount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </p>
                <p className="text-xs text-blue-500 mt-1">{deactivateResult.payrollPeriodLabel}</p>
              </div>
            )}
            <button onClick={() => setDeactivateResult(null)}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold py-2 rounded-lg">
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* ── Asignar carrito ───────────────────────────────────────────────── */}
      {cartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Asignar PDV</h3>
              <button onClick={() => setCartModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Cajero: <span className="font-medium text-slate-700">{cartModal.name}</span></p>
            <select value={selectedCartId} onChange={(e) => setSelectedCartId(e.target.value)}
              className={`${inputCls} mb-5`}>
              <option value="">— Sin PDV —</option>
              {carts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.location ? ` (${c.location})` : ''}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setCartModal(null)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={() => assignCartMut.mutate()} disabled={assignCartMut.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {assignCartMut.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
