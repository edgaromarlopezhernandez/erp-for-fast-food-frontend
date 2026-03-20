import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCancellationRequests, approveCancellation, rejectCancellation } from '../api/cancellations'
import type { CancellationRequest, CancellationRequestStatus } from '../types'
import { XCircle, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react'

const STATUS_LABELS: Record<CancellationRequestStatus, string> = {
  PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada',
}
const STATUS_COLORS: Record<CancellationRequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
}
const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

type ReviewModal = { request: CancellationRequest; action: 'approve' | 'reject' }

export default function Cancellations() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<CancellationRequestStatus | ''>('PENDING')
  const [reviewModal, setReviewModal] = useState<ReviewModal | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['cancellation-requests', statusFilter],
    queryFn: () => getCancellationRequests(statusFilter || undefined),
  })

  const approveMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      approveCancellation(id, notes ? { adminNotes: notes } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cancellation-requests'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
      setReviewModal(null); setAdminNotes('')
    },
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      rejectCancellation(id, notes ? { adminNotes: notes } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cancellation-requests'] })
      setReviewModal(null); setAdminNotes('')
    },
  })

  const openReview = (request: CancellationRequest, action: 'approve' | 'reject') => {
    setAdminNotes('')
    setReviewModal({ request, action })
  }

  const confirmReview = () => {
    if (!reviewModal) return
    const args = { id: reviewModal.request.id, notes: adminNotes || undefined }
    if (reviewModal.action === 'approve') approveMut.mutate(args)
    else rejectMut.mutate(args)
  }

  const isPending = approveMut.isPending || rejectMut.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <XCircle size={20} className="text-red-500" />
          <h2 className="text-xl font-bold text-slate-800">Solicitudes de Cancelación</h2>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CancellationRequestStatus | '')}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
        >
          <option value="PENDING">Pendientes</option>
          <option value="APPROVED">Aprobadas</option>
          <option value="REJECTED">Rechazadas</option>
          <option value="">Todas</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">
          No hay solicitudes {statusFilter ? STATUS_LABELS[statusFilter as CancellationRequestStatus].toLowerCase() + 's' : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-800">Venta #{req.saleId}</span>
                    <span className="text-xs text-slate-400">{req.cartName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status]}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Vendido el {new Date(req.soldAt).toLocaleString('es-MX')} ·{' '}
                    Solicitado por <span className="font-medium text-slate-600">{req.requestedByName}</span>{' '}
                    el {new Date(req.requestedAt).toLocaleString('es-MX')}
                  </p>
                  <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2">
                    <p className="text-xs text-slate-500 font-medium mb-0.5">Motivo:</p>
                    <p className="text-sm text-slate-700">{req.reason}</p>
                  </div>
                  {req.adminNotes && (
                    <div className="bg-violet-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-violet-500 font-medium mb-0.5">Nota del admin:</p>
                      <p className="text-sm text-violet-700">{req.adminNotes}</p>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-800 text-lg">{fmt(req.saleTotal)}</p>
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => openReview(req, 'reject')}
                        className="text-xs border border-red-300 text-red-600 hover:bg-red-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => openReview(req, 'approve')}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Aprobar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de revisión ─────────────────────────────────────────────────── */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {reviewModal.action === 'approve'
                  ? <CheckCircle size={18} className="text-green-600" />
                  : <AlertTriangle size={18} className="text-red-500" />
                }
                <h3 className="font-bold text-slate-800">
                  {reviewModal.action === 'approve' ? 'Aprobar cancelación' : 'Rechazar solicitud'}
                </h3>
              </div>
              <button onClick={() => setReviewModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>

            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4 text-sm">
              <p className="text-slate-500 text-xs mb-0.5">Motivo del empleado:</p>
              <p className="text-slate-700">{reviewModal.request.reason}</p>
            </div>

            {reviewModal.action === 'approve' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Al aprobar, la venta será cancelada y el inventario restituido automáticamente.
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nota para el empleado (opcional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                placeholder="Motivo de la decisión..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setReviewModal(null)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={confirmReview}
                disabled={isPending}
                className={`flex-1 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50 ${
                  reviewModal.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {isPending ? 'Procesando...' : reviewModal.action === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
