import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getShifts, approveShift, returnShift } from '../api/shifts'
import { getOpeningCountItems, saveOpeningCount, getCountSummary } from '../api/shiftCounts'
import type { Shift, ShiftStatus, ShiftCountItem, ShiftCountSummaryItem } from '../types'
import { Clock, CheckCircle, RotateCcw, X, AlertTriangle, TrendingUp, ClipboardCheck, ClipboardList } from 'lucide-react'

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
  const [reviewModal, setReviewModal]           = useState<ReviewModal | null>(null)
  const [adminNotes, setAdminNotes]             = useState('')
  // Conteo de apertura
  const [openingShift, setOpeningShift]         = useState<Shift | null>(null)
  const [openingItems, setOpeningItems]         = useState<ShiftCountItem[]>([])
  const [openingValues, setOpeningValues]       = useState<Record<number, string>>({})
  const [openingNotes, setOpeningNotes]         = useState<Record<number, string>>({})
  const [openingError, setOpeningError]         = useState('')
  const [openingSaving, setOpeningSaving]       = useState(false)
  // Resumen de discrepancias
  const [summaryShift, setSummaryShift]         = useState<Shift | null>(null)
  const [summaryItems, setSummaryItems]         = useState<ShiftCountSummaryItem[]>([])

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

  const openOpeningCount = async (shift: Shift) => {
    setOpeningError(''); setOpeningValues({}); setOpeningNotes({})
    const items = await getOpeningCountItems(shift.id)
    const initVals: Record<number, string> = {}
    items.forEach(i => { initVals[i.inventoryItemId] = i.openingDeclared != null ? String(i.openingDeclared) : '' })
    setOpeningItems(items); setOpeningValues(initVals); setOpeningShift(shift)
  }

  const handleSaveOpeningCount = async () => {
    if (!openingShift) return
    const entries = openingItems.map(i => ({
      inventoryItemId: i.inventoryItemId,
      declaredQuantity: Number(openingValues[i.inventoryItemId] ?? 0),
      notes: openingNotes[i.inventoryItemId] || undefined,
    }))
    const hasEmpty = entries.some(e => openingValues[e.inventoryItemId] === '')
    if (hasEmpty) { setOpeningError('Ingresa la cantidad para todos los artículos'); return }
    setOpeningSaving(true); setOpeningError('')
    try {
      await saveOpeningCount(openingShift.id, entries)
      qc.invalidateQueries({ queryKey: ['shifts'] })
      setOpeningShift(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setOpeningError(msg || 'Error al guardar el conteo')
    } finally {
      setOpeningSaving(false)
    }
  }

  const openSummary = async (shift: Shift) => {
    const items = await getCountSummary(shift.id)
    setSummaryItems(items); setSummaryShift(shift)
  }
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

                  <div className="flex flex-col gap-2 shrink-0">
                    {/* Conteo de apertura — solo en turnos OPEN */}
                    {shift.status === 'OPEN' && (
                      <button
                        onClick={() => openOpeningCount(shift)}
                        className="flex items-center gap-1 text-xs border border-blue-300 text-blue-600 hover:bg-blue-50 font-medium px-3 py-1.5 rounded-lg"
                      >
                        <ClipboardCheck size={13} /> Conteo apertura
                      </button>
                    )}
                    {/* Ver discrepancias */}
                    {(shift.status === 'PENDING_APPROVAL' || shift.status === 'APPROVED') && (
                      <button
                        onClick={() => openSummary(shift)}
                        className="flex items-center gap-1 text-xs border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium px-3 py-1.5 rounded-lg"
                      >
                        <ClipboardList size={13} /> Discrepancias
                      </button>
                    )}
                    {shift.status === 'PENDING_APPROVAL' && (
                      <div className="flex gap-2">
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
      {/* ── Modal conteo de apertura ─────────────────────────────────────── */}
      {openingShift && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl flex flex-col max-h-[92dvh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-blue-500" />
                <div>
                  <h3 className="font-bold text-slate-800">Conteo de apertura</h3>
                  <p className="text-xs text-slate-400">{openingShift.sellerName} · {openingShift.cartName}</p>
                </div>
              </div>
              <button onClick={() => setOpeningShift(null)}><X size={20} className="text-slate-400" /></button>
            </div>

            {openingItems.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                No hay artículos configurados para conteo en este carrito.
                <p className="text-xs mt-1">Activa "Requiere conteo de turno" en los insumos desde Inventario.</p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
                {openingItems.map(item => {
                  const unitSuffix = item.unitType === 'GRAM' ? 'g' : item.unitType === 'MILLILITER' ? 'ml' : 'pza'
                  return (
                    <div key={item.inventoryItemId} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-800 text-sm">{item.name}</span>
                        <div className="flex items-center gap-2">
                          {item.currentCartStock != null && (
                            <span className="text-xs text-slate-400">
                              Sistema: {item.currentCartStock.toLocaleString('es-MX')} {unitSuffix}
                            </span>
                          )}
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{unitSuffix}</span>
                        </div>
                      </div>

                      {item.containerSize && item.containerLabel && (item.unitType === 'GRAM' || item.unitType === 'MILLILITER') && (
                        <p className="text-xs text-blue-500 mb-2">
                          Recipiente: {item.containerLabel} de {item.containerSize.toLocaleString('es-MX')} {unitSuffix}
                        </p>
                      )}

                      <input
                        type="number" min={0} step={0.001}
                        placeholder={`Cantidad en ${unitSuffix}`}
                        value={openingValues[item.inventoryItemId] ?? ''}
                        onChange={e => setOpeningValues(v => ({ ...v, [item.inventoryItemId]: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text" placeholder="Nota (opcional)"
                        value={openingNotes[item.inventoryItemId] ?? ''}
                        onChange={e => setOpeningNotes(n => ({ ...n, [item.inventoryItemId]: e.target.value }))}
                        className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-slate-400 placeholder:text-slate-300"
                      />
                    </div>
                  )
                })}
              </div>
            )}

            <div className="px-5 pb-5 pt-3 border-t border-slate-100 shrink-0">
              {openingError && (
                <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> {openingError}
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setOpeningShift(null)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm py-2.5 rounded-xl hover:bg-slate-50">
                  Cancelar
                </button>
                {openingItems.length > 0 && (
                  <button
                    onClick={handleSaveOpeningCount}
                    disabled={openingSaving}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl"
                  >
                    {openingSaving ? 'Guardando...' : 'Registrar conteo'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal resumen de discrepancias ───────────────────────────────── */}
      {summaryShift && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl flex flex-col max-h-[92dvh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-violet-500" />
                <div>
                  <h3 className="font-bold text-slate-800">Discrepancias de inventario</h3>
                  <p className="text-xs text-slate-400">{summaryShift.sellerName} · {summaryShift.cartName}</p>
                </div>
              </div>
              <button onClick={() => setSummaryShift(null)}><X size={20} className="text-slate-400" /></button>
            </div>

            {summaryItems.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                No hay conteos registrados para este turno.
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3">
                {summaryItems.map(item => {
                  const unitSuffix = item.unitType === 'GRAM' ? 'g' : item.unitType === 'MILLILITER' ? 'ml' : 'pza'
                  const closing = item.closingDiscrepancy
                  const discClass = closing == null ? 'text-slate-400'
                    : closing < 0 ? 'text-red-600 font-bold' : closing > 0 ? 'text-amber-600' : 'text-green-600'
                  return (
                    <div key={item.inventoryItemId} className={`border rounded-xl p-4 ${
                      closing != null && closing < 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-slate-800">{item.itemName}</span>
                        <span className="text-xs text-slate-400">{unitSuffix}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {/* Apertura */}
                        <div className="bg-blue-50 rounded-lg p-2.5">
                          <p className="text-blue-500 font-semibold mb-1">Apertura (admin)</p>
                          {item.openingDeclared != null ? (
                            <>
                              <p className="text-slate-700">Declarado: <span className="font-bold">{item.openingDeclared.toLocaleString('es-MX')} {unitSuffix}</span></p>
                              <p className="text-slate-500">Sistema: {item.openingExpected?.toLocaleString('es-MX') ?? '—'} {unitSuffix}</p>
                              {item.openingDiscrepancy != null && item.openingDiscrepancy !== 0 && (
                                <p className={item.openingDiscrepancy < 0 ? 'text-red-600 font-semibold' : 'text-amber-600'}>
                                  Δ {item.openingDiscrepancy > 0 ? '+' : ''}{item.openingDiscrepancy.toLocaleString('es-MX')} {unitSuffix}
                                </p>
                              )}
                              <p className="text-slate-400 mt-1">{item.openingCountedBy}</p>
                            </>
                          ) : <p className="text-slate-400">Sin conteo</p>}
                        </div>

                        {/* Cierre */}
                        <div className={`rounded-lg p-2.5 ${closing != null && closing < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                          <p className={`font-semibold mb-1 ${closing != null && closing < 0 ? 'text-red-500' : 'text-green-600'}`}>
                            Cierre (empleado)
                          </p>
                          {item.closingDeclared != null ? (
                            <>
                              <p className="text-slate-700">Declarado: <span className="font-bold">{item.closingDeclared.toLocaleString('es-MX')} {unitSuffix}</span></p>
                              <p className="text-slate-500">Esperado: {item.closingExpected?.toLocaleString('es-MX') ?? '—'} {unitSuffix}</p>
                              <p className={`font-semibold ${discClass}`}>
                                Δ {closing != null ? `${closing > 0 ? '+' : ''}${closing.toLocaleString('es-MX')} ${unitSuffix}` : '—'}
                              </p>
                              <p className="text-slate-400 mt-1">{item.closingCountedBy}</p>
                            </>
                          ) : <p className="text-slate-400">Sin conteo</p>}
                        </div>
                      </div>

                      {closing != null && closing < 0 && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                          <AlertTriangle size={11} className="shrink-0" />
                          Faltante de {Math.abs(closing).toLocaleString('es-MX')} {unitSuffix} — posible merma o faltante
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="px-5 pb-5 pt-3 border-t border-slate-100 shrink-0">
              <button onClick={() => setSummaryShift(null)}
                className="w-full border border-slate-300 text-slate-700 text-sm py-2.5 rounded-xl hover:bg-slate-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
