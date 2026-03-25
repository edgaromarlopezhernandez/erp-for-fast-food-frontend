import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPayrollDueToday, getPayrollPayments,
  recordPayrollPayment, getIncidences, createIncidence, deleteIncidence,
  getGoals, upsertGoal, deleteGoal,
} from '../api/payroll'
import type {
  DuePayrollItem, PayrollPeriod, PayrollIncidenceRequest,
  PayrollGoalRequest, PayrollGoalBonusType, UserResponse,
} from '../types'
import {
  DollarSign, CheckCircle, X, AlertTriangle,
  Plus, Trash2, Target, TrendingUp, ChevronDown, ChevronUp, Printer,
} from 'lucide-react'
import axios from 'axios'
import { getUsers } from '../api/users'
import PayrollReceipt from '../components/PayrollReceipt'

const PERIOD_LABELS: Record<PayrollPeriod, string> = {
  BIWEEKLY: 'Quincenal', WEEKLY: 'Semanal', MONTHLY: 'Mensual',
}
const BONUS_TYPE_LABELS: Record<PayrollGoalBonusType, string> = {
  FLAT: 'Monto fijo',
  SALARY_PERCENTAGE: '% del sueldo',
  EXCESS_PERCENTAGE: '% del excedente',
}
const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const fmtPct = (n: number) => `${n.toFixed(1)}%`

export default function Payroll() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'due' | 'history' | 'incidences' | 'goals'>('due')

  const { data: dueToday = [] } = useQuery({ queryKey: ['payroll-due'], queryFn: getPayrollDueToday })
  const [historyEmployee, setHistoryEmployee] = useState<number | undefined>()
  const { data: payments = [] } = useQuery({
    queryKey: ['payroll-payments', historyEmployee],
    queryFn: () => getPayrollPayments(historyEmployee),
  })
  const { data: incidences = [] } = useQuery({ queryKey: ['payroll-incidences'], queryFn: () => getIncidences() })
  const { data: goals = [] } = useQuery({ queryKey: ['payroll-goals'], queryFn: getGoals })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const employees: UserResponse[] = users.filter((u: UserResponse) => !u.isOwner && u.active)

  // ── Receipt modal ─────────────────────────────────────────────────────────
  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null)

  // ── Pay modal ─────────────────────────────────────────────────────────────
  const [payModal, setPayModal] = useState<DuePayrollItem | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [payError, setPayError] = useState<string | null>(null)
  const [expandedDue, setExpandedDue] = useState<number | null>(null)

  const payMut = useMutation({
    mutationFn: () => recordPayrollPayment({
      employeeId: payModal!.employeeId,
      amount: Number(customAmount),
      periodLabel: payModal!.periodLabel,
      notes: payNotes || undefined,
      includeGoalBonus: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-payments'] })
      qc.invalidateQueries({ queryKey: ['payroll-due'] })
      setPayModal(null); setCustomAmount(''); setPayNotes(''); setPayError(null)
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        setPayError(err.response?.data?.message ?? 'Error al registrar el pago')
      }
    },
  })

  const openPay = (item: DuePayrollItem) => {
    setCustomAmount(item.suggestedTotal.toFixed(2))
    setPayNotes('')
    setPayError(null)
    setPayModal(item)
  }

  // ── Incidence modal ───────────────────────────────────────────────────────
  const [showIncModal, setShowIncModal] = useState(false)
  const [incForm, setIncForm] = useState<Partial<PayrollIncidenceRequest>>({ type: 'BONUS' })

  const createIncMut = useMutation({
    mutationFn: (req: PayrollIncidenceRequest) => createIncidence(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-incidences'] })
      qc.invalidateQueries({ queryKey: ['payroll-due'] })
      setShowIncModal(false)
      setIncForm({ type: 'BONUS' })
    },
  })
  const deleteIncMut = useMutation({
    mutationFn: (id: number) => deleteIncidence(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-incidences'] })
      qc.invalidateQueries({ queryKey: ['payroll-due'] })
    },
  })

  // ── Goal modal ────────────────────────────────────────────────────────────
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalForm, setGoalForm] = useState<Partial<PayrollGoalRequest>>({ bonusType: 'EXCESS_PERCENTAGE' })

  const upsertGoalMut = useMutation({
    mutationFn: (req: PayrollGoalRequest) => upsertGoal(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-goals'] })
      qc.invalidateQueries({ queryKey: ['payroll-due'] })
      setShowGoalModal(false)
      setGoalForm({ bonusType: 'EXCESS_PERCENTAGE' })
    },
  })
  const deleteGoalMut = useMutation({
    mutationFn: (id: number) => deleteGoal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-goals'] })
      qc.invalidateQueries({ queryKey: ['payroll-due'] })
    },
  })

  const pendingIncidences = incidences.filter(i => !i.paymentId)

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-10">
      <div className="flex items-center gap-2">
        <DollarSign size={20} className="text-green-600" />
        <h2 className="text-xl font-bold text-slate-800">Nómina</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 text-sm">
        {(['due', 'history', 'incidences', 'goals'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {{ due: 'Hoy', history: 'Historial', incidences: 'Incidencias', goals: 'Metas' }[t]}
          </button>
        ))}
      </div>

      {/* ── Tab: Pagos de hoy ─────────────────────────────────────────────── */}
      {tab === 'due' && (
        <div className="space-y-3">
          {dueToday.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle size={16} /> No hay pagos de nómina programados para hoy.
            </div>
          ) : (
            dueToday.map(item => {
              const expanded = expandedDue === item.employeeId
              const hasPending = item.pendingIncidences.length > 0
              const hasGoal = !!item.goalProgress
              return (
                <div key={item.employeeId} className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                  {/* Header row */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{item.employeeName}</p>
                      <p className="text-xs text-slate-500">@{item.username} · {PERIOD_LABELS[item.payrollPeriod]}</p>
                      <p className="text-xs text-amber-600 font-medium mt-0.5">{item.periodLabel}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-slate-600">
                          {item.shiftWorkedDays}/{item.expectedWorkingDays} días
                        </span>
                        {item.shiftWorkedDays < item.expectedWorkingDays && (
                          <span className="text-xs text-red-500">
                            ({item.expectedWorkingDays - item.shiftWorkedDays} faltas)
                          </span>
                        )}
                        {hasPending && (
                          <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                            {item.pendingIncidences.length} incidencia{item.pendingIncidences.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {hasGoal && item.goalProgress!.goalMet && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                            ✓ Meta cumplida
                          </span>
                        )}
                        {hasGoal && !item.goalProgress!.goalMet && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                            {fmtPct(item.goalProgress!.achievementPct)} meta
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="font-bold text-slate-800 text-lg">{fmt(item.suggestedTotal)}</p>
                      {item.suggestedTotal !== item.amountDue && (
                        <p className="text-xs text-slate-400">base {fmt(item.amountDue)}</p>
                      )}
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => setExpandedDue(expanded ? null : item.employeeId)}
                          className="text-xs text-slate-400 hover:text-slate-600 px-1"
                        >
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button
                          onClick={() => openPay(item)}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Pagar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded breakdown */}
                  {expanded && (
                    <div className="border-t border-amber-200 bg-white px-4 py-3 space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Sueldo base ({item.daysWorked}/{item.expectedWorkingDays} días)</span>
                        <span>{fmt(item.amountDue)}</span>
                      </div>
                      {item.pendingIncidences.map(inc => (
                        <div key={inc.id} className="flex justify-between">
                          <span className="text-slate-500">{inc.concept}</span>
                          <span className={inc.type === 'BONUS' ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
                            {inc.type === 'BONUS' ? '+' : '-'}{fmt(inc.amount)}
                          </span>
                        </div>
                      ))}
                      {item.goalProgress?.goalMet && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Bono por meta ({fmtPct(item.goalProgress.achievementPct)})</span>
                          <span className="text-emerald-700 font-medium">+{fmt(item.goalProgress.bonusAmount)}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-200 flex justify-between font-semibold pt-2">
                        <span>Total sugerido</span>
                        <span>{fmt(item.suggestedTotal)}</span>
                      </div>
                      {item.goalProgress && !item.goalProgress.goalMet && (
                        <div className="bg-slate-50 rounded-lg p-2 text-xs text-slate-500">
                          Meta de ventas: {fmt(item.goalProgress.salesTarget)} · Real: {fmt(item.goalProgress.actualSales)} ({fmtPct(item.goalProgress.achievementPct)})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Tab: Historial ───────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {/* Employee filter */}
          <select
            value={historyEmployee ?? ''}
            onChange={e => setHistoryEmployee(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">Todos los empleados</option>
            {employees.map((u: UserResponse) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {payments.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Sin pagos registrados.</p>
          ) : (
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{p.employeeName}</p>
                    <p className="text-xs text-slate-400">{p.periodLabel}</p>
                    {p.notes && <p className="text-xs text-slate-400 italic">{p.notes}</p>}
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <p className="font-bold text-green-700">{fmt(p.amount)}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(p.paidDate + 'T12:00:00').toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <button
                      onClick={() => setReceiptPaymentId(p.id)}
                      className="text-slate-400 hover:text-violet-600 transition-colors p-1"
                      title="Ver recibo"
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Incidencias ─────────────────────────────────────────────── */}
      {tab === 'incidences' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Bonos y descuentos que se aplicarán al próximo pago del empleado</p>
            <button
              onClick={() => setShowIncModal(true)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors shrink-0"
            >
              <Plus size={14} /> Nueva
            </button>
          </div>

          {pendingIncidences.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-6">Sin incidencias pendientes.</p>
          )}

          {pendingIncidences.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pendientes</p>
              {pendingIncidences.map(inc => (
                <div key={inc.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inc.type === 'BONUS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {inc.type === 'BONUS' ? 'Bono' : 'Descuento'}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{inc.concept}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{inc.employeeName} · {inc.periodLabel}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-bold ${inc.type === 'BONUS' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {inc.type === 'BONUS' ? '+' : '-'}{fmt(inc.amount)}
                    </span>
                    <button
                      onClick={() => { if (confirm('¿Eliminar incidencia?')) deleteIncMut.mutate(inc.id) }}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {incidences.filter(i => i.paymentId).length > 0 && (
            <details className="mt-2">
              <summary className="text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer">
                Aplicadas ({incidences.filter(i => i.paymentId).length})
              </summary>
              <div className="space-y-1 mt-2">
                {incidences.filter(i => i.paymentId).map(inc => (
                  <div key={inc.id} className="bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500 truncate">{inc.employeeName} · {inc.concept}</span>
                    <span className={`shrink-0 ml-2 ${inc.type === 'BONUS' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {inc.type === 'BONUS' ? '+' : '-'}{fmt(inc.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Tab: Metas ───────────────────────────────────────────────────── */}
      {tab === 'goals' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Define metas de ventas con bono automático al empleado</p>
            <button
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors shrink-0"
            >
              <Plus size={14} /> Nueva
            </button>
          </div>

          {/* Explanation card */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-xs text-violet-700 space-y-1">
            <p className="font-semibold">¿Cómo funciona?</p>
            <p>Si configuras <strong>Meta $5,000 · % del excedente 30%</strong> y el empleado vende $6,000:</p>
            <p>Bono = 30% × ($6,000 − $5,000) = <strong>$300</strong></p>
          </div>

          {goals.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Sin metas configuradas.</p>
          ) : (
            <div className="space-y-2">
              {goals.map(g => {
                const emp = employees.find((u: UserResponse) => u.id === g.employeeId)
                return (
                  <div key={g.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Target size={14} className="text-violet-500" />
                        <span className="font-semibold text-slate-800 text-sm">{emp?.name ?? `#${g.employeeId}`}</span>
                        {!g.active && <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">Inactiva</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Meta: {fmt(g.salesTarget)} · {BONUS_TYPE_LABELS[g.bonusType]}
                        {g.bonusType === 'FLAT' ? ` ${fmt(g.bonusValue)}` : ` ${g.bonusValue}%`}
                      </p>
                    </div>
                    <button
                      onClick={() => { if (confirm('¿Eliminar meta?')) deleteGoalMut.mutate(g.id) }}
                      className="text-slate-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Registrar pago ────────────────────────────────────────── */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPayModal(null)} />
          <div className="relative z-50 w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Registrar pago</h3>
              <button onClick={() => setPayModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{payModal.employeeName}</span>
              <span className="text-slate-400 ml-1">· {payModal.periodLabel}</span>
            </p>

            {/* Breakdown summary */}
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Sueldo base</span><span>{fmt(payModal.amountDue)}</span>
              </div>
              {payModal.pendingIncidences.map(inc => (
                <div key={inc.id} className="flex justify-between">
                  <span className="text-slate-500">{inc.concept}</span>
                  <span className={inc.type === 'BONUS' ? 'text-emerald-700' : 'text-red-600'}>
                    {inc.type === 'BONUS' ? '+' : '-'}{fmt(inc.amount)}
                  </span>
                </div>
              ))}
              {payModal.goalProgress?.goalMet && (
                <div className="flex justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <TrendingUp size={12} /> Bono meta ({fmtPct(payModal.goalProgress.achievementPct)})
                  </span>
                  <span className="text-emerald-700">+{fmt(payModal.goalProgress.bonusAmount)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 flex justify-between font-semibold pt-1.5">
                <span>Sugerido</span><span>{fmt(payModal.suggestedTotal)}</span>
              </div>
            </div>

            {payError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{payError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Monto a pagar $</label>
                <input
                  type="number" step="0.01" value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Notas (opcional)</label>
                <input value={payNotes} onChange={e => setPayNotes(e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayModal(null)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2.5 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => payMut.mutate()}
                disabled={!customAmount || payMut.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg"
              >
                {payMut.isPending ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nueva incidencia ──────────────────────────────────────── */}
      {showIncModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowIncModal(false)} />
          <div className="relative z-50 w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Nueva incidencia</h3>
              <button onClick={() => setShowIncModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Empleado *</label>
                <select
                  value={incForm.employeeId ?? ''}
                  onChange={e => setIncForm(f => ({ ...f, employeeId: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                >
                  <option value="">Selecciona empleado</option>
                  {employees.map((u: UserResponse) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Periodo *</label>
                <input
                  type="text" placeholder="ej: Quincena 1 — Marzo 2026"
                  value={incForm.periodLabel ?? ''}
                  onChange={e => setIncForm(f => ({ ...f, periodLabel: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Tipo *</label>
                <div className="flex gap-2">
                  {(['BONUS', 'DEDUCTION'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setIncForm(f => ({ ...f, type: t }))}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        incForm.type === t
                          ? t === 'BONUS'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'BONUS' ? '+ Bono' : '− Descuento'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Concepto *</label>
                <input
                  type="text" placeholder="ej: Bono puntualidad"
                  value={incForm.concept ?? ''}
                  onChange={e => setIncForm(f => ({ ...f, concept: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Monto $*</label>
                <input
                  type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={incForm.amount ?? ''}
                  onChange={e => setIncForm(f => ({ ...f, amount: parseFloat(e.target.value) || undefined }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowIncModal(false)}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!incForm.employeeId || !incForm.periodLabel || !incForm.type || !incForm.concept || !incForm.amount) return
                  createIncMut.mutate(incForm as PayrollIncidenceRequest)
                }}
                disabled={createIncMut.isPending || !incForm.employeeId || !incForm.periodLabel || !incForm.concept || !incForm.amount}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium"
              >
                {createIncMut.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nueva meta ────────────────────────────────────────────── */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowGoalModal(false)} />
          <div className="relative z-50 w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Meta de ventas</h3>
              <button onClick={() => setShowGoalModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Empleado *</label>
                <select
                  value={goalForm.employeeId ?? ''}
                  onChange={e => setGoalForm(f => ({ ...f, employeeId: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                >
                  <option value="">Selecciona empleado</option>
                  {employees.map((u: UserResponse) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Meta de ventas $ *</label>
                <input
                  type="number" min="0" step="0.01" placeholder="ej: 5000"
                  value={goalForm.salesTarget ?? ''}
                  onChange={e => setGoalForm(f => ({ ...f, salesTarget: parseFloat(e.target.value) || undefined }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="text-xs text-slate-400 mt-1">Ventas mínimas en el periodo para activar el bono</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Tipo de bono *</label>
                <select
                  value={goalForm.bonusType ?? 'EXCESS_PERCENTAGE'}
                  onChange={e => setGoalForm(f => ({ ...f, bonusType: e.target.value as PayrollGoalBonusType }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                >
                  <option value="EXCESS_PERCENTAGE">% del excedente sobre la meta</option>
                  <option value="SALARY_PERCENTAGE">% del sueldo base</option>
                  <option value="FLAT">Monto fijo</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  {goalForm.bonusType === 'FLAT' ? 'Monto del bono $' : 'Porcentaje (%)'} *
                </label>
                <input
                  type="number" min="0" step={goalForm.bonusType === 'FLAT' ? '0.01' : '1'}
                  placeholder={goalForm.bonusType === 'FLAT' ? '200' : '30'}
                  value={goalForm.bonusValue ?? ''}
                  onChange={e => setGoalForm(f => ({ ...f, bonusValue: parseFloat(e.target.value) || undefined }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                {goalForm.bonusType === 'EXCESS_PERCENTAGE' && goalForm.salesTarget && goalForm.bonusValue && (
                  <p className="text-xs text-violet-600 mt-1">
                    Ejemplo: si vende {fmt(goalForm.salesTarget * 1.2)}, bono = {fmt(goalForm.salesTarget * 0.2 * goalForm.bonusValue / 100)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowGoalModal(false)}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!goalForm.employeeId || !goalForm.salesTarget || !goalForm.bonusType || !goalForm.bonusValue) return
                  upsertGoalMut.mutate({ ...goalForm, active: true } as PayrollGoalRequest)
                }}
                disabled={upsertGoalMut.isPending || !goalForm.employeeId || !goalForm.salesTarget || !goalForm.bonusValue}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium"
              >
                {upsertGoalMut.isPending ? 'Guardando...' : 'Guardar meta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt modal ─────────────────────────────────────────────────── */}
      {receiptPaymentId && (
        <PayrollReceipt
          paymentId={receiptPaymentId}
          onClose={() => setReceiptPaymentId(null)}
        />
      )}
    </div>
  )
}