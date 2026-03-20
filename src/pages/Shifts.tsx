import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getShifts, approveShift, returnShift } from '../api/shifts'
import type { Shift, ShiftStatus } from '../types'
import { Clock, CheckCircle, RotateCcw, X, AlertTriangle, TrendingUp } from 'lucide-react'

const STATUS_LABELS: Record<ShiftStatus, string> = {
  OPEN: 'En curso', PENDING_APPROVAL: 'Pendiente', APPROVED: 'Aprobado',
}
const STATUS_COLORS: Record<ShiftStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
}
const fmt = (n?: number | null) =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

type ReviewModal = { shift: Shift; action: 'approve' | 'return' }

export default function Shifts() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<ShiftStatus | ''>('PENDING_APPROVAL')
  const [reviewModal, setReviewModal] = useState<ReviewModal | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', statusFilter],
    queryFn: () => getShifts(statusFilter || undefined),
  })

  const approveMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      approveShift(id, notes ? { adminNotes: notes } : undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); closeModal() },
  })
  const returnMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      returnShift(id, notes ? { adminNotes: notes } : undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); closeModal() },
  })

  const closeModal = () => { setReviewModal(null); setAdminNotes('') }
  const openReview = (shift: Shift, action: 'approve' | 'return') => {
    setAdminNotes(''); setReviewModal({ shift, action })
  }
  const confirmReview = () => {
    if (!reviewModal) return
    const args = { id: reviewModal.shift.id, notes: adminNotes || undefined }
    if (reviewModal.action === 'approve') approveMut.mutate(args)
    else returnMut.mutate(args)
  }
  const isPending = approveMut.isPending || returnMut.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-blue-500" />
          <h2 className="text-xl font-bold text-slate-800">Turnos</h2>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ShiftStatus | '')}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
        >
          <option value="PENDING_APPROVAL">Pendientes de aprobación</option>
          <option value="OPEN">En curso</option>
          <option value="APPROVED">Aprobados</option>
          <option value="">Todos</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">
          No hay turnos {statusFilter === 'PENDING_APPROVAL' ? 'pendientes' : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map((shift) => {
            const diff = shift.difference ?? 0
            return (
              <div key={shift.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-800">{shift.sellerName}</span>
                      <span className="text-xs text-slate-400">· {shift.cartName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[shift.status]}`}>
                        {STATUS_LABELS[shift.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      Apertura: {new Date(shift.openedAt).toLocaleString('es-MX')}
                      {shift.closedAt && ` · Cierre: ${new Date(shift.closedAt).toLocaleString('es-MX')}`}
                    </p>

                    {/* Grid de montos */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs text-slate-400">Fondo inicial</p>
                        <p className="font-semibold text-slate-800">{fmt(shift.startingCash)}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-xs text-slate-400">Ventas ({shift.saleCount})</p>
                        <p className="font-semibold text-green-700">{fmt(shift.totalSales)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-xs text-slate-400">Esperado</p>
                        <p className="font-semibold text-blue-700">{fmt(shift.expectedCash)}</p>
                      </div>
                      <div className={`rounded-lg p-2 ${
                        shift.declaredCash == null ? 'bg-slate-50'
                        : diff > 0 ? 'bg-amber-50' : diff < 0 ? 'bg-red-50' : 'bg-green-50'
                      }`}>
                        <p className="text-xs text-slate-400">Entregado</p>
                        <p className={`font-semibold ${
                          shift.declaredCash == null ? 'text-slate-400'
                          : diff > 0 ? 'text-amber-700' : diff < 0 ? 'text-red-600' : 'text-green-700'
                        }`}>
                          {shift.declaredCash == null ? '—' : fmt(shift.declaredCash)}
                        </p>
                        {shift.difference != null && shift.difference !== 0 && (
                          <p className={`text-xs font-medium ${diff > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                            {diff > 0 ? `+${fmt(diff)} sobrante` : `${fmt(diff)} faltante`}
                          </p>
                        )}
                        {shift.difference === 0 && shift.declaredCash != null && (
                          <p className="text-xs text-green-600 font-medium">Cuadra exacto</p>
                        )}
                      </div>
                    </div>

                    {shift.adminNotes && (
                      <div className="mt-2 bg-violet-50 rounded-lg px-3 py-2 text-xs text-violet-700">
                        <span className="font-medium">Nota admin:</span> {shift.adminNotes}
                      </div>
                    )}
                  </div>

                  {shift.status === 'PENDING_APPROVAL' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openReview(shift, 'return')}
                        className="flex items-center gap-1 text-xs border border-amber-300 text-amber-600 hover:bg-amber-50 font-medium px-3 py-1.5 rounded-lg"
                      >
                        <RotateCcw size={13} /> Devolver
                      </button>
                      <button
                        onClick={() => openReview(shift, 'approve')}
                        className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg"
                      >
                        <CheckCircle size={13} /> Aprobar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de revisión */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {reviewModal.action === 'approve'
                  ? <CheckCircle size={18} className="text-green-600" />
                  : <RotateCcw size={18} className="text-amber-500" />}
                <h3 className="font-bold text-slate-800">
                  {reviewModal.action === 'approve' ? 'Aprobar turno' : 'Devolver al cajero'}
                </h3>
              </div>
              <button onClick={closeModal}><X size={20} className="text-slate-400" /></button>
            </div>

            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4 text-sm space-y-1">
              <p className="text-slate-700 font-medium">{reviewModal.shift.sellerName}</p>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Esperado</span><span className="font-medium">{fmt(reviewModal.shift.expectedCash)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Entregado</span><span className="font-medium">{fmt(reviewModal.shift.declaredCash)}</span>
              </div>
              {reviewModal.shift.difference != null && reviewModal.shift.difference !== 0 && (
                <div className={`flex justify-between text-xs font-semibold ${
                  (reviewModal.shift.difference ?? 0) < 0 ? 'text-red-500' : 'text-amber-600'
                }`}>
                  <span>Diferencia</span>
                  <span>{(reviewModal.shift.difference ?? 0) > 0 ? '+' : ''}{fmt(reviewModal.shift.difference)}</span>
                </div>
              )}
            </div>

            {reviewModal.action === 'return' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                El turno volverá a "En curso" y el cajero podrá hacer un nuevo cierre.
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 block mb-1">
                {reviewModal.action === 'return' ? 'Motivo de devolución (obligatorio)' : 'Nota (opcional)'}
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                placeholder={reviewModal.action === 'return' ? 'Ej: Hay un faltante de $50, reencuenta la caja...' : 'Observaciones...'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={closeModal}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={confirmReview}
                disabled={isPending || (reviewModal.action === 'return' && !adminNotes.trim())}
                className={`flex-1 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50 ${
                  reviewModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {isPending ? 'Procesando...' : reviewModal.action === 'approve' ? 'Aprobar' : 'Devolver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
