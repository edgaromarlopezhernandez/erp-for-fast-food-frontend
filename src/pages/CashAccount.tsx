import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet, TrendingUp, TrendingDown, Plus, Pencil, Trash2,
  X, Save, AlertTriangle, CheckCircle, ArrowDownCircle, Package
} from 'lucide-react'
import {
  getCashAccount,
  setInitialCapital,
  createWithdrawal,
  deleteWithdrawal,
  createDeposit,
  deleteDeposit,
} from '../api/cashAccount'
import type { WithdrawalCategory, WithdrawalRequest, DepositCategory, CashDepositRequest } from '../types'

const WITHDRAWAL_LABELS: Record<WithdrawalCategory, string> = {
  OWNER_PROFIT: 'Retiro de utilidades',
  REINVESTMENT: 'Reinversión',
  OTHER: 'Otro',
}

const DEPOSIT_LABELS: Record<DepositCategory, string> = {
  OWNER_INJECTION: 'Aportación del dueño',
  LOAN: 'Préstamo',
  OTHER: 'Otro',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function CashAccount() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cash-account'],
    queryFn: getCashAccount,
  })

  // ── Initial capital inline edit ───────────────────────────────────────────
  const [editingCapital, setEditingCapital] = useState(false)
  const [capitalInput, setCapitalInput] = useState('')

  const capitalMutation = useMutation({
    mutationFn: (amount: number) => setInitialCapital(amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-account'] })
      setEditingCapital(false)
    },
  })

  const handleSaveCapital = () => {
    const val = parseFloat(capitalInput)
    if (isNaN(val) || val < 0) return
    capitalMutation.mutate(val)
  }

  // ── Withdrawal modal ──────────────────────────────────────────────────────
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [withdrawalForm, setWithdrawalForm] = useState<Partial<WithdrawalRequest>>({
    category: 'OWNER_PROFIT',
  })

  const createWithdrawalMutation = useMutation({
    mutationFn: (req: WithdrawalRequest) => createWithdrawal(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-account'] })
      setShowWithdrawalModal(false)
      setWithdrawalForm({ category: 'OWNER_PROFIT' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteWithdrawal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-account'] }),
  })

  const handleCreateWithdrawal = () => {
    if (!withdrawalForm.amount || withdrawalForm.amount <= 0 || !withdrawalForm.category) return
    createWithdrawalMutation.mutate({
      amount: withdrawalForm.amount,
      withdrawalDate: withdrawalForm.withdrawalDate,
      category: withdrawalForm.category,
      notes: withdrawalForm.notes,
    })
  }

  // ── Deposit modal ─────────────────────────────────────────────────────────
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositForm, setDepositForm] = useState<Partial<CashDepositRequest>>({
    category: 'OWNER_INJECTION',
  })

  const createDepositMutation = useMutation({
    mutationFn: (req: CashDepositRequest) => createDeposit(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-account'] })
      setShowDepositModal(false)
      setDepositForm({ category: 'OWNER_INJECTION' })
    },
  })

  const deleteDepositMutation = useMutation({
    mutationFn: (id: number) => deleteDeposit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-account'] }),
  })

  const handleCreateDeposit = () => {
    if (!depositForm.amount || depositForm.amount <= 0 || !depositForm.category) return
    createDepositMutation.mutate({
      amount: depositForm.amount,
      depositDate: depositForm.depositDate,
      category: depositForm.category,
      notes: depositForm.notes,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        Cargando caja...
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 text-red-600 p-4">
        <AlertTriangle size={20} />
        Error al cargar la caja del negocio.
      </div>
    )
  }

  const isPositive = data.currentBalance >= 0

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={22} className="text-violet-600" />
          <h1 className="text-xl font-bold text-slate-800">Caja del Negocio</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <ArrowDownCircle size={16} />
            Depositar
          </button>
          <button
            onClick={() => setShowWithdrawalModal(true)}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Retiro
          </button>
        </div>
      </div>

      {/* Balance card */}
      <div className={`rounded-2xl p-6 text-white ${isPositive ? 'bg-emerald-600' : 'bg-red-600'}`}>
        <div className="text-sm font-medium opacity-80 mb-1">Capital líquido</div>
        <div className="text-4xl font-bold tracking-tight">{fmt(data.currentBalance)}</div>
        <div className="flex items-center gap-1.5 mt-2 text-sm opacity-80">
          {isPositive
            ? <><CheckCircle size={16} /> Balance positivo</>
            : <><AlertTriangle size={16} /> Balance negativo</>
          }
        </div>
      </div>

      {/* Patrimony breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Desglose patrimonial
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 flex items-center gap-1.5">
              <Wallet size={14} className="text-slate-400" />
              Capital líquido
            </span>
            <span className={`text-sm font-semibold ${data.currentBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {fmt(data.currentBalance)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 flex items-center gap-1.5">
              <Package size={14} className="text-slate-400" />
              Inventario en stock
            </span>
            <span className="text-sm font-semibold text-blue-700">
              {fmt(data.inventoryValue)}
            </span>
          </div>
          <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-800">Patrimonio total</span>
            <span className={`text-base font-bold ${data.totalPatrimony >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
              {fmt(data.totalPatrimony)}
            </span>
          </div>
        </div>
      </div>

      {/* Initial capital */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500 font-medium">Capital inicial</span>
          {!editingCapital && (
            <button
              onClick={() => {
                setCapitalInput(String(data.initialCapital))
                setEditingCapital(true)
              }}
              className="text-slate-400 hover:text-violet-600 transition-colors"
            >
              <Pencil size={15} />
            </button>
          )}
        </div>
        {editingCapital ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={capitalInput}
              onChange={e => setCapitalInput(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="0.00"
              autoFocus
            />
            <button
              onClick={handleSaveCapital}
              disabled={capitalMutation.isPending}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
            >
              <Save size={14} /> Guardar
            </button>
            <button
              onClick={() => setEditingCapital(false)}
              className="text-slate-400 hover:text-slate-600 px-2"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="text-2xl font-semibold text-slate-800 mt-1">{fmt(data.initialCapital)}</div>
        )}
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          label="Ingresos por ventas"
          value={data.totalSalesIncome}
          color="emerald"
          icon={<TrendingUp size={18} />}
        />
        <SummaryCard
          label="Depósitos al negocio"
          value={data.totalDepositsIn}
          color="emerald"
          icon={<ArrowDownCircle size={18} />}
        />
        <SummaryCard
          label="Salidas por resurtidos"
          value={data.totalPurchasesOut}
          color="red"
          icon={<TrendingDown size={18} />}
        />
        <SummaryCard
          label="Gastos operativos"
          value={data.totalExpensesOut}
          color="red"
          icon={<TrendingDown size={18} />}
        />
        <SummaryCard
          label="Nómina pagada"
          value={data.totalPayrollOut}
          color="red"
          icon={<TrendingDown size={18} />}
        />
        <SummaryCard
          label="Retiros del dueño"
          value={data.totalWithdrawalsOut}
          color="orange"
          icon={<TrendingDown size={18} />}
        />
      </div>

      {/* Recent deposits */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Depósitos recientes
        </h2>
        {data.recentDeposits.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            No hay depósitos registrados
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentDeposits.map(d => (
              <div
                key={d.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold text-emerald-700">{fmt(d.amount)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.category === 'OWNER_INJECTION'
                        ? 'bg-emerald-100 text-emerald-700'
                        : d.category === 'LOAN'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {DEPOSIT_LABELS[d.category]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {fmtDate(d.depositDate)}
                    {d.createdByName && ` · ${d.createdByName}`}
                  </div>
                  {d.notes && (
                    <div className="text-xs text-slate-400 mt-1 truncate">{d.notes}</div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm('¿Eliminar este depósito?')) deleteDepositMutation.mutate(d.id)
                  }}
                  className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent withdrawals */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Retiros recientes
        </h2>
        {data.recentWithdrawals.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            No hay retiros registrados
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentWithdrawals.map(w => (
              <div
                key={w.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold text-slate-800">{fmt(w.amount)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      w.category === 'OWNER_PROFIT'
                        ? 'bg-violet-100 text-violet-700'
                        : w.category === 'REINVESTMENT'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {WITHDRAWAL_LABELS[w.category]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {fmtDate(w.withdrawalDate)}
                    {w.createdByName && ` · ${w.createdByName}`}
                  </div>
                  {w.notes && (
                    <div className="text-xs text-slate-400 mt-1 truncate">{w.notes}</div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm('¿Eliminar este retiro?')) deleteMutation.mutate(w.id)
                  }}
                  className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDepositModal(false)} />
          <div className="relative z-50 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Depositar fondos</h3>
              <button onClick={() => setShowDepositModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={depositForm.amount ?? ''}
                  onChange={e => setDepositForm(f => ({ ...f, amount: parseFloat(e.target.value) || undefined }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                <CheckCircle size={13} className="text-slate-400 shrink-0" />
                Fecha registrada automáticamente por el sistema: <span className="font-medium text-slate-600">{new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <select
                  value={depositForm.category ?? 'OWNER_INJECTION'}
                  onChange={e => setDepositForm(f => ({ ...f, category: e.target.value as DepositCategory }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {(Object.keys(DEPOSIT_LABELS) as DepositCategory[]).map(k => (
                    <option key={k} value={k}>{DEPOSIT_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <textarea
                  rows={2}
                  placeholder="Opcional..."
                  value={depositForm.notes ?? ''}
                  onChange={e => setDepositForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowDepositModal(false)}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDeposit}
                disabled={createDepositMutation.isPending || !depositForm.amount || (depositForm.amount ?? 0) <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {createDepositMutation.isPending ? 'Guardando...' : 'Guardar depósito'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal modal */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowWithdrawalModal(false)} />
          <div className="relative z-50 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Registrar retiro</h3>
              <button onClick={() => setShowWithdrawalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={withdrawalForm.amount ?? ''}
                  onChange={e => setWithdrawalForm(f => ({ ...f, amount: parseFloat(e.target.value) || undefined }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                <CheckCircle size={13} className="text-slate-400 shrink-0" />
                Fecha registrada automáticamente por el sistema: <span className="font-medium text-slate-600">{new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <select
                  value={withdrawalForm.category ?? 'OWNER_PROFIT'}
                  onChange={e => setWithdrawalForm(f => ({ ...f, category: e.target.value as WithdrawalCategory }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                >
                  {(Object.keys(WITHDRAWAL_LABELS) as WithdrawalCategory[]).map(k => (
                    <option key={k} value={k}>{WITHDRAWAL_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <textarea
                  rows={2}
                  placeholder="Opcional..."
                  value={withdrawalForm.notes ?? ''}
                  onChange={e => setWithdrawalForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowWithdrawalModal(false)}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateWithdrawal}
                disabled={createWithdrawalMutation.isPending || !withdrawalForm.amount || (withdrawalForm.amount ?? 0) <= 0}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {createWithdrawalMutation.isPending ? 'Guardando...' : 'Guardar retiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string
  value: number
  color: 'emerald' | 'red' | 'orange'
  icon: React.ReactNode
  wide?: boolean
}

function SummaryCard({ label, value, color, icon, wide }: SummaryCardProps) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
  }

  return (
    <div className={`rounded-xl border p-4 ${colors[color]} ${wide ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold">
        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)}
      </div>
    </div>
  )
}