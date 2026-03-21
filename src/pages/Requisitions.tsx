import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getRequisitions, approveRequisition, rejectRequisition,
  dispatchRequisition, receiveRequisition, autoGenerate,
  type RequisitionResponse, type RequisitionStatus, type RequisitionItemResponse,
} from '../api/requisitions'
import { getCarts } from '../api/carts'
import {
  CheckCircle, XCircle, Truck, PackageCheck, AlertTriangle,
  ChevronDown, ChevronUp, X, RotateCcw, Zap,
} from 'lucide-react'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<RequisitionStatus, { label: string; badge: string }> = {
  SOLICITADA:       { label: 'Solicitada',        badge: 'bg-blue-100 text-blue-700' },
  APROBADA:         { label: 'Aprobada',           badge: 'bg-green-100 text-green-700' },
  RECHAZADA:        { label: 'Rechazada',          badge: 'bg-red-100 text-red-700' },
  EN_TRANSITO:      { label: 'En tránsito',        badge: 'bg-amber-100 text-amber-700' },
  COMPLETADO:       { label: 'Completada',         badge: 'bg-violet-100 text-violet-700' },
  CON_DISCREPANCIA: { label: 'Con discrepancia',   badge: 'bg-orange-100 text-orange-700' },
}

const UNIT: Record<string, string> = { PIECE: 'pza', GRAM: 'g', MILLILITER: 'ml' }
const fmt = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(2)
const fmtDate = (d: string) => new Date(d).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

const STATUS_FILTERS: Array<{ value: RequisitionStatus | ''; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'SOLICITADA', label: 'Solicitadas' },
  { value: 'APROBADA', label: 'Aprobadas' },
  { value: 'EN_TRANSITO', label: 'En tránsito' },
  { value: 'COMPLETADO', label: 'Completadas' },
  { value: 'CON_DISCREPANCIA', label: 'Discrepancias' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
]

export default function Requisitions() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | ''>('')
  const [expanded, setExpanded] = useState<number | null>(null)

  // Action modals
  const [approveModal, setApproveModal] = useState<RequisitionResponse | null>(null)
  const [rejectModal, setRejectModal]   = useState<RequisitionResponse | null>(null)
  const [dispatchModal, setDispatchModal] = useState<RequisitionResponse | null>(null)
  const [receiveModal, setReceiveModal]   = useState<RequisitionResponse | null>(null)

  // Auto-generate
  const [generateCartId, setGenerateCartId] = useState<number | undefined>()
  const [generateError, setGenerateError]   = useState('')

  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const activeCarts = carts.filter((c) => c.active)

  const { data: requisitions = [], isLoading } = useQuery({
    queryKey: ['requisitions', statusFilter],
    queryFn: () => getRequisitions(statusFilter || undefined),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['requisitions'] })

  const generateMut = useMutation({
    mutationFn: () => autoGenerate(generateCartId!),
    onSuccess: () => { invalidate(); setGenerateError('') },
    onError: (e: any) => setGenerateError(e?.response?.data?.message ?? 'Error al generar.'),
  })

  if (isLoading) return <div className="text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Requisiciones de Traspaso</h2>
        {/* Auto-generate */}
        <div className="flex items-center gap-2">
          <select
            value={generateCartId ?? ''}
            onChange={(e) => setGenerateCartId(e.target.value ? Number(e.target.value) : undefined)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-violet-500"
          >
            <option value="">Seleccionar carrito...</option>
            {activeCarts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => generateMut.mutate()}
            disabled={!generateCartId || generateMut.isPending}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Zap size={14} /> Generar automático
          </button>
        </div>
      </div>
      {generateError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <AlertTriangle size={14} /> {generateError}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              statusFilter === value
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
            {value === '' && requisitions.length > 0 && (
              <span className="ml-1.5 bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-xs">
                {requisitions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {requisitions.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-10">Sin requisiciones{statusFilter ? ` con estado "${STATUS_CFG[statusFilter]?.label}"` : ''}.</p>
        )}
        {requisitions.map((req) => (
          <RequisitionCard
            key={req.id}
            req={req}
            expanded={expanded === req.id}
            onToggle={() => setExpanded(expanded === req.id ? null : req.id)}
            onApprove={() => setApproveModal(req)}
            onReject={() => setRejectModal(req)}
            onDispatch={() => setDispatchModal(req)}
            onReceive={() => setReceiveModal(req)}
          />
        ))}
      </div>

      {/* ── Approve modal ─────────────────────────────────────────────────────── */}
      {approveModal && (
        <ApproveModal
          req={approveModal}
          onClose={() => setApproveModal(null)}
          onDone={invalidate}
        />
      )}

      {/* ── Reject modal ──────────────────────────────────────────────────────── */}
      {rejectModal && (
        <SimpleActionModal
          title="Rechazar requisición"
          description={`¿Rechazar la requisición de "${rejectModal.cartName}"?`}
          notesLabel="Motivo del rechazo"
          confirmLabel="Rechazar"
          confirmClass="bg-red-500 hover:bg-red-600"
          onClose={() => setRejectModal(null)}
          onConfirm={async (notes) => {
            await rejectRequisition(rejectModal.id, { adminNotes: notes })
            invalidate()
            setRejectModal(null)
          }}
        />
      )}

      {/* ── Dispatch modal ────────────────────────────────────────────────────── */}
      {dispatchModal && (
        <DispatchModal
          req={dispatchModal}
          onClose={() => setDispatchModal(null)}
          onDone={invalidate}
        />
      )}

      {/* ── Receive modal ─────────────────────────────────────────────────────── */}
      {receiveModal && (
        <ReceiveModal
          req={receiveModal}
          onClose={() => setReceiveModal(null)}
          onDone={invalidate}
        />
      )}
    </div>
  )
}

// ── Requisition card ──────────────────────────────────────────────────────────

function RequisitionCard({
  req, expanded, onToggle, onApprove, onReject, onDispatch, onReceive,
}: {
  req: RequisitionResponse
  expanded: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  onDispatch: () => void
  onReceive: () => void
}) {
  const cfg = STATUS_CFG[req.status]
  const hasDiscrepancy = req.status === 'CON_DISCREPANCIA'

  return (
    <div className={`bg-white rounded-xl border ${hasDiscrepancy ? 'border-orange-300' : 'border-slate-200'} overflow-hidden`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">{req.cartName}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
            {hasDiscrepancy && <AlertTriangle size={14} className="text-orange-500" />}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Solicitado por <span className="font-medium text-slate-500">{req.requestedByName}</span>
            {' · '}{fmtDate(req.createdAt)}
            {' · '}{req.items.length} insumo{req.items.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          {req.status === 'SOLICITADA' && (
            <>
              <button onClick={onApprove}
                className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium px-3 py-1.5 rounded-lg">
                <CheckCircle size={13} /> Aprobar
              </button>
              <button onClick={onReject}
                className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-3 py-1.5 rounded-lg">
                <XCircle size={13} /> Rechazar
              </button>
            </>
          )}
          {req.status === 'APROBADA' && (
            <button onClick={onDispatch}
              className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium px-3 py-1.5 rounded-lg">
              <Truck size={13} /> Despachar
            </button>
          )}
          {req.status === 'EN_TRANSITO' && (
            <button onClick={onReceive}
              className="flex items-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 font-medium px-3 py-1.5 rounded-lg">
              <PackageCheck size={13} /> Recibir
            </button>
          )}
          <button onClick={onToggle}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100">
          {/* Notes */}
          {(req.adminNotes || req.dispatchNotes || req.receiptNotes) && (
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 space-y-1">
              {req.adminNotes    && <p className="text-xs text-slate-600"><span className="font-medium">Nota admin:</span> {req.adminNotes}</p>}
              {req.dispatchNotes && <p className="text-xs text-slate-600"><span className="font-medium">Notas despacho:</span> {req.dispatchNotes}</p>}
              {req.receiptNotes  && <p className="text-xs text-slate-600"><span className="font-medium">Notas recepción:</span> {req.receiptNotes}</p>}
            </div>
          )}

          {/* Timeline */}
          <div className="px-5 py-3 flex gap-6 text-xs text-slate-500 border-b border-slate-100 flex-wrap">
            {req.approvedAt    && <span><span className="font-medium">{req.status === 'RECHAZADA' ? 'Rechazado' : 'Aprobado'}</span> por {req.approvedByName} · {fmtDate(req.approvedAt)}</span>}
            {req.dispatchedAt  && <span><span className="font-medium">Despachado</span> por {req.dispatchedByName} · {fmtDate(req.dispatchedAt)}</span>}
            {req.receivedAt    && <span><span className="font-medium">Recibido</span> por {req.receivedByName} · {fmtDate(req.receivedAt)}</span>}
          </div>

          {/* Items table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left px-5 py-2 font-medium">Insumo</th>
                <th className="text-right px-4 py-2 font-medium">Solicitado</th>
                <th className="text-right px-4 py-2 font-medium">Aprobado</th>
                <th className="text-right px-4 py-2 font-medium">Despachado</th>
                <th className="text-right px-4 py-2 font-medium">Recibido</th>
                {req.status === 'CON_DISCREPANCIA' && (
                  <th className="text-right px-4 py-2 font-medium">Diferencia</th>
                )}
                {(req.status === 'SOLICITADA' || req.status === 'APROBADA') && (
                  <th className="text-right px-4 py-2 font-medium">En bodega</th>
                )}
              </tr>
            </thead>
            <tbody>
              {req.items.map((item) => {
                const u = UNIT[item.unitType] ?? item.unitType
                const disc = item.discrepancy
                return (
                  <tr key={item.id} className={`border-b border-slate-100 last:border-0 ${disc && disc !== 0 ? 'bg-orange-50/40' : ''}`}>
                    <td className="px-5 py-2.5 font-medium text-slate-800">{item.inventoryItemName}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(item.requestedQuantity)} {u}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {item.approvedQuantity != null ? <>{fmt(item.approvedQuantity)} {u}</> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {item.dispatchedQuantity != null ? <>{fmt(item.dispatchedQuantity)} {u}</> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {item.receivedQuantity != null ? <>{fmt(item.receivedQuantity)} {u}</> : <span className="text-slate-300">—</span>}
                    </td>
                    {req.status === 'CON_DISCREPANCIA' && (
                      <td className={`px-4 py-2.5 text-right font-semibold ${disc && disc > 0 ? 'text-red-600' : disc && disc < 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {disc != null ? (disc > 0 ? `-${fmt(disc)}` : disc < 0 ? `+${fmt(Math.abs(disc))}` : '✓') : '—'} {disc != null && disc !== 0 ? u : ''}
                      </td>
                    )}
                    {(req.status === 'SOLICITADA' || req.status === 'APROBADA') && (
                      <td className={`px-4 py-2.5 text-right ${item.centralStock < item.requestedQuantity ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                        {fmt(item.centralStock)} {u}
                        {item.centralStock < item.requestedQuantity && (
                          <span className="ml-1 text-xs">⚠</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Approve modal ─────────────────────────────────────────────────────────────

function ApproveModal({ req, onClose, onDone }: {
  req: RequisitionResponse; onClose: () => void; onDone: () => void
}) {
  const [quantities, setQuantities] = useState<Record<number, string>>(
    Object.fromEntries(req.items.map((i) => [i.id, String(i.requestedQuantity)]))
  )
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => approveRequisition(req.id, {
      approvedQuantities: Object.fromEntries(
        Object.entries(quantities).map(([k, v]) => [Number(k), parseFloat(v)])
      ),
      adminNotes: notes || undefined,
    }),
    onSuccess: () => { onDone(); onClose() },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al aprobar.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Aprobar requisición — {req.cartName}</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-slate-500">Puedes ajustar las cantidades aprobadas por ítem.</p>
          {req.items.map((item) => {
            const u = UNIT[item.unitType] ?? item.unitType
            const insufficientStock = item.centralStock < item.requestedQuantity
            return (
              <div key={item.id} className={`flex items-center gap-3 ${insufficientStock ? 'bg-red-50 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.inventoryItemName}</p>
                  <p className="text-xs text-slate-400">
                    Solicitado: {fmt(item.requestedQuantity)} {u}
                    {' · '}
                    <span className={insufficientStock ? 'text-red-600 font-semibold' : 'text-slate-400'}>
                      Bodega: {fmt(item.centralStock)} {u}
                      {insufficientStock && ' ⚠ stock insuficiente'}
                    </span>
                  </p>
                </div>
                <input
                  type="number" step="0.01" min="0"
                  value={quantities[item.id] ?? ''}
                  onChange={(e) => setQuantities({ ...quantities, [item.id]: e.target.value })}
                  className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-500"
                />
                <span className="text-xs text-slate-400 w-8">{u}</span>
              </div>
            )
          })}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Notas (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones de la aprobación..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
            {mut.isPending ? 'Aprobando...' : 'Confirmar aprobación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dispatch modal ────────────────────────────────────────────────────────────

function DispatchModal({ req, onClose, onDone }: {
  req: RequisitionResponse; onClose: () => void; onDone: () => void
}) {
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => dispatchRequisition(req.id, { dispatchNotes: notes || undefined }),
    onSuccess: () => { onDone(); onClose() },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al despachar.'),
  })

  const hasInsufficient = req.items.some(
    (i) => i.centralStock < (i.approvedQuantity ?? i.requestedQuantity)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-amber-600" />
            <h3 className="font-bold text-slate-800">Despachar — {req.cartName}</h3>
          </div>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {hasInsufficient && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Hay insumos con stock insuficiente en bodega. Verifica antes de continuar.
            </div>
          )}
          <div className="space-y-1">
            {req.items.map((item) => {
              const u = UNIT[item.unitType] ?? item.unitType
              const qty = item.approvedQuantity ?? item.requestedQuantity
              const ok = item.centralStock >= qty
              return (
                <div key={item.id} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                  <span className="text-slate-700">{item.inventoryItemName}</span>
                  <span className={`font-medium ${ok ? 'text-slate-700' : 'text-red-600'}`}>
                    {fmt(qty)} {u} {ok ? '' : '⚠'}
                  </span>
                </div>
              )
            })}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Notas de despacho (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="ej. Entrega turno matutino..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
            {mut.isPending ? 'Despachando...' : 'Confirmar despacho'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Receive modal (blind) ─────────────────────────────────────────────────────

function ReceiveModal({ req, onClose, onDone }: {
  req: RequisitionResponse; onClose: () => void; onDone: () => void
}) {
  const [quantities, setQuantities] = useState<Record<number, string>>(
    Object.fromEntries(req.items.map((i) => [i.id, '']))
  )
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => receiveRequisition(req.id, {
      receivedQuantities: Object.fromEntries(
        Object.entries(quantities).map(([k, v]) => [Number(k), parseFloat(v) || 0])
      ),
      receiptNotes: notes || undefined,
    }),
    onSuccess: () => { onDone(); onClose() },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al registrar recepción.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <PackageCheck size={18} className="text-violet-600" />
            <h3 className="font-bold text-slate-800">Recepción — {req.cartName}</h3>
          </div>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-2 rounded-lg">
            Ingresa las cantidades <strong>físicamente recibidas</strong>. El sistema comparará automáticamente
            con lo que fue despachado y registrará cualquier diferencia.
          </div>
          {req.items.map((item) => {
            const u = UNIT[item.unitType] ?? item.unitType
            return (
              <div key={item.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.inventoryItemName}</p>
                  <p className="text-xs text-slate-400">Unidad: {u}</p>
                </div>
                <input
                  type="number" step="0.01" min="0"
                  value={quantities[item.id]}
                  onChange={(e) => setQuantities({ ...quantities, [item.id]: e.target.value })}
                  placeholder="0"
                  className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-violet-500"
                />
                <span className="text-xs text-slate-400 w-8">{u}</span>
              </div>
            )
          })}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Notas de recepción</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones del encargado que recibe..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
            {mut.isPending ? 'Registrando...' : 'Confirmar recepción'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Simple action modal (reject) ──────────────────────────────────────────────

function SimpleActionModal({ title, description, notesLabel, confirmLabel, confirmClass, onClose, onConfirm }: {
  title: string; description: string; notesLabel: string
  confirmLabel: string; confirmClass: string
  onClose: () => void; onConfirm: (notes: string) => Promise<void>
}) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    setLoading(true)
    try { await onConfirm(notes) } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error.')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <p className="text-sm text-slate-600 mb-4">{description}</p>
        <div className="mb-4">
          <label className="text-sm font-medium text-slate-700 block mb-1">{notesLabel}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" />
        </div>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={handle} disabled={loading}
            className={`flex-1 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg ${confirmClass}`}>
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
