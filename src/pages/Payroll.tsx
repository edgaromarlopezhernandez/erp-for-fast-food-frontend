import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPayrollDueToday, getPayrollPayments, recordPayrollPayment } from '../api/payroll'
import type { DuePayrollItem, PayrollPeriod } from '../types'
import { DollarSign, Bell, CheckCircle, X, ClipboardList } from 'lucide-react'

const PERIOD_LABELS: Record<PayrollPeriod, string> = {
  BIWEEKLY: 'Quincenal', WEEKLY: 'Semanal', MONTHLY: 'Mensual',
}
const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export default function Payroll() {
  const qc = useQueryClient()
  const { data: dueToday = [] } = useQuery({ queryKey: ['payroll-due'], queryFn: getPayrollDueToday })
  const { data: payments = [] } = useQuery({ queryKey: ['payroll-payments'], queryFn: getPayrollPayments })

  const [payModal, setPayModal] = useState<DuePayrollItem | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [notes, setNotes] = useState('')

  const payMut = useMutation({
    mutationFn: () => recordPayrollPayment({
      employeeId: payModal!.employeeId,
      amount: customAmount ? Number(customAmount) : payModal!.amountDue,
      periodLabel: payModal!.periodLabel,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-payments'] })
      setPayModal(null); setCustomAmount(''); setNotes('')
    },
  })

  const openPay = (item: DuePayrollItem) => {
    setCustomAmount(item.amountDue.toString())
    setNotes('')
    setPayModal(item)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <DollarSign size={20} className="text-green-600" />
        <h2 className="text-xl font-bold text-slate-800">Nómina</h2>
      </div>

      {/* Vencen hoy */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bell size={15} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Pagos pendientes hoy</h3>
        </div>
        {dueToday.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle size={16} /> No hay pagos de nómina programados para hoy.
          </div>
        ) : (
          <div className="space-y-2">
            {dueToday.map((item) => (
              <div key={item.employeeId}
                className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{item.employeeName}</p>
                  <p className="text-xs text-slate-500">@{item.username} · {PERIOD_LABELS[item.payrollPeriod]}</p>
                  <p className="text-xs text-amber-600 font-medium mt-0.5">{item.periodLabel}</p>
                  {/* Asistencia del periodo */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-slate-600 font-medium">
                      {item.shiftWorkedDays}/{item.expectedWorkingDays} días trabajados
                    </span>
                    {item.shiftWorkedDays < item.expectedWorkingDays && (
                      <span className="text-xs text-red-500">
                        ({item.expectedWorkingDays - item.shiftWorkedDays} faltas)
                      </span>
                    )}
                    {item.shiftWorkedDays >= item.expectedWorkingDays && (
                      <span className="text-xs text-green-600">✓ Completo</span>
                    )}
                  </div>
                  {item.prorated && (
                    <p className="text-xs text-orange-600 mt-0.5">
                      Primer periodo · contratado el {item.hireDate ? new Date(item.hireDate + 'T12:00:00').toLocaleDateString('es-MX') : '—'}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-800 text-lg">{fmt(item.amountDue)}</p>
                  {item.amountDue < item.salary && (
                    <p className="text-xs text-slate-400 line-through">{fmt(item.salary)}</p>
                  )}
                  <button onClick={() => openPay(item)}
                    className="mt-1 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
                    Registrar pago
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial de pagos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList size={15} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Historial de pagos</h3>
        </div>
        {payments.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">Sin pagos registrados aún.</p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{p.employeeName}</p>
                    <p className="text-xs text-slate-400">{p.periodLabel}</p>
                    {p.notes && <p className="text-xs text-slate-400 italic">{p.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-green-700">{fmt(p.amount)}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(p.paidDate + 'T12:00:00').toLocaleDateString('es-MX')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Modal registrar pago ────────────────────────────────────────────── */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Registrar pago</h3>
              <button onClick={() => setPayModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              Empleado: <span className="font-medium text-slate-800">{payModal.employeeName}</span>
            </p>
            <p className="text-xs text-amber-600 mb-2">{payModal.periodLabel}</p>
            {payModal.prorated && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3 text-xs text-orange-700">
                Pago prorateado: {payModal.daysWorked} de {payModal.totalDaysInPeriod} días del periodo
                {payModal.hireDate && ` · contratado el ${new Date(payModal.hireDate + 'T12:00:00').toLocaleDateString('es-MX')}`}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Monto a pagar $</label>
                <input type="number" step="0.01" value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                <p className="text-xs text-slate-400 mt-0.5">
                  Sueldo completo: {fmt(payModal.salary)}
                  {payModal.prorated && ` · prorateado: ${fmt(payModal.amountDue)}`}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Notas (opcional)</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setPayModal(null)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={() => payMut.mutate()} disabled={!customAmount || payMut.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                {payMut.isPending ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
