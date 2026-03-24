import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import {
  getRequisitions, getRequisitionMonths, approveRequisition, rejectRequisition,
  dispatchRequisition, receiveRequisition, autoGenerate,
  requestRecount, registerMerma,
  type RequisitionResponse, type RequisitionStatus,
} from '../api/requisitions'
import { getCarts } from '../api/carts'
import {
  CheckCircle, XCircle, Truck, PackageCheck, AlertTriangle,
  ChevronDown, ChevronUp, X, RotateCcw, Zap, Scale, FileWarning, BadgeAlert, Lightbulb,
} from 'lucide-react'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<RequisitionStatus, { label: string; badge: string }> = {
  SOLICITADA:          { label: 'Solicitada',          badge: 'bg-blue-100 text-blue-700' },
  APROBADA:            { label: 'Aprobada',             badge: 'bg-green-100 text-green-700' },
  RECHAZADA:           { label: 'Rechazada',            badge: 'bg-red-100 text-red-700' },
  EN_TRANSITO:         { label: 'En tránsito',          badge: 'bg-amber-100 text-amber-700' },
  COMPLETADO:          { label: 'Completada',           badge: 'bg-violet-100 text-violet-700' },
  CON_DISCREPANCIA:    { label: 'Con discrepancia',     badge: 'bg-orange-100 text-orange-700' },
  RECONTEO_SOLICITADO: { label: 'Reconteo solicitado',  badge: 'bg-yellow-100 text-yellow-700' },
  MERMA_REGISTRADA:    { label: 'Merma registrada',     badge: 'bg-rose-100 text-rose-700' },
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
  { value: 'RECONTEO_SOLICITADO', label: 'Reconteo' },
  { value: 'MERMA_REGISTRADA', label: 'Mermas' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
]

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function Requisitions() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | ''>('')
  const [monthFilter, setMonthFilter] = useState<string>(currentYearMonth())
  const [expanded, setExpanded] = useState<number | null>(null)

  // Action modals
  const [approveModal, setApproveModal]   = useState<RequisitionResponse | null>(null)
  const [rejectModal, setRejectModal]     = useState<RequisitionResponse | null>(null)
  const [dispatchModal, setDispatchModal] = useState<RequisitionResponse | null>(null)
  const [receiveModal, setReceiveModal]   = useState<RequisitionResponse | null>(null)
  const [recountModal, setRecountModal]   = useState<RequisitionResponse | null>(null)
  const [mermaModal, setMermaModal]       = useState<RequisitionResponse | null>(null)

  // Auto-generate
  const [generateCartId, setGenerateCartId] = useState<number | undefined>()
  const [generateError, setGenerateError]   = useState('')

  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const activeCarts = carts.filter((c) => c.active)

  const { data: availableMonths = [] } = useQuery({
    queryKey: ['requisition-months'],
    queryFn: getRequisitionMonths,
  })

  // Ensure current month is always present in the selector even if there's no data yet
  const monthOptions = availableMonths.includes(monthFilter)
    ? availableMonths
    : [monthFilter, ...availableMonths]

  const [selectedYear, selectedMonth] = monthFilter.split('-').map(Number)

  const { data: requisitions = [], isLoading } = useQuery({
    queryKey: ['requisitions', statusFilter, monthFilter],
    queryFn: () => getRequisitions({
      status: statusFilter || undefined,
      year: selectedYear,
      month: selectedMonth,
    }),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['requisitions'] })
    qc.invalidateQueries({ queryKey: ['requisition-months'] })
  }

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

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Month selector */}
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-violet-500"
        >
          {monthOptions.map((ym) => {
            const [y, m] = ym.split('-').map(Number)
            const label = new Date(y, m - 1, 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' })
            return <option key={ym} value={ym}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
          })}
        </select>

        {/* Status pills */}
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
      </div>

      {/* List */}
      <div className="space-y-3">
        {requisitions.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-10">
            Sin requisiciones{statusFilter ? ` con estado "${STATUS_CFG[statusFilter]?.label}"` : ''} en este mes.
          </p>
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
            onRequestRecount={() => setRecountModal(req)}
            onRegisterMerma={() => setMermaModal(req)}
            onRegisterMermaAuto={() => { setExpanded(req.id); setMermaModal(req) }}
          />
        ))}
      </div>

      {/* ── Approve modal ─────────────────────────────────────────────────────── */}
      {approveModal && (
        <ApproveModal req={approveModal} onClose={() => setApproveModal(null)} onDone={invalidate} />
      )}

      {/* ── Reject modal ──────────────────────────────────────────────────────── */}
      {rejectModal && (
        <SimpleActionModal
          title="Rechazar requisición"
          description={`¿Rechazar la requisición de "${rejectModal.cartName}"?`}
          notesLabel="Motivo del rechazo"
          confirmLabel="Rechazar"
          confirmClass="bg-red-500 hover:bg-red-600"
          required={false}
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
        <DispatchModal req={dispatchModal} onClose={() => setDispatchModal(null)} onDone={invalidate} />
      )}

      {/* ── Receive modal ─────────────────────────────────────────────────────── */}
      {receiveModal && (
        <ReceiveModal req={receiveModal} onClose={() => setReceiveModal(null)} onDone={invalidate} />
      )}

      {/* ── Request recount modal ─────────────────────────────────────────────── */}
      {recountModal && (
        <SimpleActionModal
          title="Solicitar reconteo"
          description={`Solicitar al vendedor de "${recountModal.cartName}" que realice un segundo conteo ciego. Solo se puede solicitar una vez.`}
          notesLabel="Mensaje al vendedor (opcional)"
          confirmLabel="Solicitar reconteo"
          confirmClass="bg-yellow-500 hover:bg-yellow-600"
          required={false}
          onClose={() => setRecountModal(null)}
          onConfirm={async (notes) => {
            await requestRecount(recountModal.id, { recountNotes: notes || undefined })
            invalidate()
            setRecountModal(null)
          }}
        />
      )}

      {/* ── Register merma modal ──────────────────────────────────────────────── */}
      {mermaModal && (
        <RegisterMermaModal
          req={mermaModal}
          onClose={() => setMermaModal(null)}
          onDone={invalidate}
        />
      )}
    </div>
  )
}

// ── Requisition card ──────────────────────────────────────────────────────────

function RequisitionCard({
  req, expanded, onToggle, onApprove, onReject, onDispatch, onReceive,
  onRequestRecount, onRegisterMerma, onRegisterMermaAuto,
}: {
  req: RequisitionResponse
  expanded: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  onDispatch: () => void
  onReceive: () => void
  onRequestRecount: () => void
  onRegisterMerma: () => void
  onRegisterMermaAuto: () => void
}) {
  const cfg = STATUS_CFG[req.status]
  const hasDiscrepancy = req.status === 'CON_DISCREPANCIA'
  const isRecount      = req.status === 'RECONTEO_SOLICITADO'
  const isMerma        = req.status === 'MERMA_REGISTRADA'
  // Reconteo ya realizado y confirmó faltante — acción urgente requerida
  const recountDoneWithLoss = hasDiscrepancy
    && req.recountRequestedAt != null
    && req.items.some(i => i.recountQuantity != null)

  return (
    <div className={`bg-white rounded-xl border ${
      recountDoneWithLoss ? 'border-red-400 shadow-sm shadow-red-100' :
      hasDiscrepancy      ? 'border-orange-300' :
      isRecount           ? 'border-yellow-300' :
      isMerma             ? 'border-rose-300' :
      'border-slate-200'
    } overflow-hidden`}>
      {/* Banner urgente post-reconteo */}
      {recountDoneWithLoss && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-200">
          <BadgeAlert size={14} className="text-red-600 shrink-0" />
          <p className="text-xs text-red-700 font-medium">
            Reconteo completado — faltante confirmado. Se requiere registrar la merma.
          </p>
          <button onClick={onRegisterMermaAuto}
            className="ml-auto shrink-0 flex items-center gap-1 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded-lg">
            <Scale size={12} /> Registrar merma
          </button>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">{req.cartName}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
            {hasDiscrepancy && !recountDoneWithLoss && <AlertTriangle size={14} className="text-orange-500" />}
            {recountDoneWithLoss && <AlertTriangle size={14} className="text-red-500" />}
            {isRecount           && <RotateCcw size={14} className="text-yellow-600" />}
            {isMerma             && <FileWarning size={14} className="text-rose-500" />}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Solicitado por <span className="font-medium text-slate-500">{req.requestedByName}</span>
            {' · '}{fmtDate(req.createdAt)}
            {' · '}{req.items.length} insumo{req.items.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0 flex-wrap">
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
          {req.status === 'CON_DISCREPANCIA' && !recountDoneWithLoss && (
            <>
              {!req.recountRequestedAt && (
                <button onClick={onRequestRecount}
                  className="flex items-center gap-1 text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium px-3 py-1.5 rounded-lg">
                  <RotateCcw size={13} /> Solicitar reconteo
                </button>
              )}
              <button onClick={onRegisterMerma}
                className="flex items-center gap-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium px-3 py-1.5 rounded-lg">
                <Scale size={13} /> Registrar merma
              </button>
            </>
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
          {(req.adminNotes || req.dispatchNotes || req.receiptNotes || req.recountNotes || req.mermaReason || req.adminCoverageReason) && (
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 space-y-1">
              {req.adminCoverageReason && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 flex items-start gap-1">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                  <span><span className="font-medium">Cobertura por admin:</span> {req.adminCoverageReason}</span>
                </p>
              )}
              {req.adminNotes    && <p className="text-xs text-slate-600"><span className="font-medium">Nota admin:</span> {req.adminNotes}</p>}
              {req.dispatchNotes && <p className="text-xs text-slate-600"><span className="font-medium">Notas despacho:</span> {req.dispatchNotes}</p>}
              {req.receiptNotes  && <p className="text-xs text-slate-600"><span className="font-medium">Notas recepción:</span> {req.receiptNotes}</p>}
              {req.recountNotes  && (
                <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                  <span className="font-medium">Motivo reconteo:</span> {req.recountNotes}
                </p>
              )}
              {req.mermaReason && (
                <p className={`text-xs rounded px-2 py-1 ${req.mermaType === 'DAÑO' ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50'}`}>
                  <span className="font-medium">
                    Merma ({req.mermaType === 'DAÑO' ? 'daño/descomposición' : 'faltante'}):
                  </span>{' '}
                  {req.mermaReason}
                </p>
              )}
              {req.mermaDeductionAmount != null && (
                <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1 font-medium">
                  Descuento registrado en nómina del administrador: ${req.mermaDeductionAmount.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="px-5 py-3 flex gap-6 text-xs text-slate-500 border-b border-slate-100 flex-wrap">
            {req.approvedAt         && <span><span className="font-medium">{req.status === 'RECHAZADA' ? 'Rechazado' : 'Aprobado'}</span> por {req.approvedByName} · {fmtDate(req.approvedAt)}</span>}
            {req.dispatchedAt       && <span><span className="font-medium">Despachado</span> por {req.dispatchedByName} · {fmtDate(req.dispatchedAt)}</span>}
            {req.receivedAt         && (
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium">Recibido</span> por {req.receivedByName} · {fmtDate(req.receivedAt)}
                {req.adminCoverageReceive && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    <AlertTriangle size={10} /> Admin en cobertura
                  </span>
                )}
              </span>
            )}
            {req.recountRequestedAt && <span><span className="font-medium text-yellow-700">Reconteo solicitado</span> por {req.recountRequestedByName} · {fmtDate(req.recountRequestedAt)}</span>}
            {req.mermaRegisteredAt  && <span><span className="font-medium text-rose-700">Merma registrada</span> por {req.mermaRegisteredByName} · {fmtDate(req.mermaRegisteredAt)}</span>}
          </div>

          {/* Items table con scroll horizontal */}
          <ItemsTable req={req} />
        </div>
      )}
    </div>
  )
}

// ── Items table ───────────────────────────────────────────────────────────────

function ItemsTable({ req }: { req: RequisitionResponse }) {
  const hasRecountData  = req.items.some(i => i.recountQuantity != null)
  const hasReceivedData = req.items.some(i => i.receivedQuantity != null)
  const showDiff        = hasReceivedData && req.items.some(i => i.discrepancy != null)
  const showStock       = req.status === 'SOLICITADA' || req.status === 'APROBADA'

  const discColor = (v: number | null) =>
    v == null ? '' : v > 0 ? 'text-red-600 font-semibold' : v < 0 ? 'text-amber-600 font-semibold' : 'text-green-600'
  const discLabel = (v: number | null, u: string) =>
    v == null ? '—' : v > 0 ? `-${fmt(v)} ${u}` : v < 0 ? `+${fmt(Math.abs(v))} ${u}` : '✓'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-max">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-100">
            <th className="text-left px-5 py-2 font-medium">Insumo</th>
            <th className="text-right px-4 py-2 font-medium">Solicitado</th>
            <th className="text-right px-4 py-2 font-medium">Aprobado</th>
            <th className="text-right px-4 py-2 font-medium">Despachado</th>
            {hasReceivedData  && <th className="text-right px-4 py-2 font-medium">Recibido</th>}
            {showDiff         && <th className="text-right px-4 py-2 font-medium text-orange-500">Diferencia</th>}
            {hasRecountData   && <th className="text-right px-4 py-2 font-medium text-yellow-600">Reconteo</th>}
            {hasRecountData   && <th className="text-right px-4 py-2 font-medium text-red-600">Dif. Final</th>}
            {showStock        && <th className="text-right px-4 py-2 font-medium">En bodega</th>}
          </tr>
        </thead>
        <tbody>
          {req.items.map((item) => {
            const u    = UNIT[item.unitType] ?? item.unitType
            const disc = item.discrepancy
            const fin  = item.finalDiscrepancy
            const rowBg = fin != null && fin !== 0 ? 'bg-red-50/40'
                        : disc != null && disc !== 0 ? 'bg-orange-50/40'
                        : ''
            return (
              <tr key={item.id} className={`border-b border-slate-100 last:border-0 ${rowBg}`}>
                <td className="px-5 py-2.5 font-medium text-slate-800 whitespace-nowrap">{item.inventoryItemName}</td>
                <td className="px-4 py-2.5 text-right text-slate-600 whitespace-nowrap">{fmt(item.requestedQuantity)} {u}</td>
                <td className="px-4 py-2.5 text-right text-slate-600 whitespace-nowrap">
                  {item.approvedQuantity != null ? <>{fmt(item.approvedQuantity)} {u}</> : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-600 whitespace-nowrap">
                  {item.dispatchedQuantity != null ? <>{fmt(item.dispatchedQuantity)} {u}</> : <span className="text-slate-300">—</span>}
                </td>
                {hasReceivedData && (
                  <td className="px-4 py-2.5 text-right text-slate-600 whitespace-nowrap">
                    {item.receivedQuantity != null ? <>{fmt(item.receivedQuantity)} {u}</> : <span className="text-slate-300">—</span>}
                  </td>
                )}
                {showDiff && (
                  <td className={`px-4 py-2.5 text-right whitespace-nowrap ${discColor(disc)}`}>
                    {discLabel(disc, u)}
                  </td>
                )}
                {hasRecountData && (
                  <td className="px-4 py-2.5 text-right text-yellow-700 font-medium whitespace-nowrap">
                    {item.recountQuantity != null ? <>{fmt(item.recountQuantity)} {u}</> : <span className="text-slate-300">—</span>}
                  </td>
                )}
                {hasRecountData && (
                  <td className={`px-4 py-2.5 text-right whitespace-nowrap ${discColor(fin)}`}>
                    {discLabel(fin, u)}
                  </td>
                )}
                {showStock && (
                  <td className={`px-4 py-2.5 text-right whitespace-nowrap ${item.centralStock < item.requestedQuantity ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                    {fmt(item.centralStock)} {u}
                    {item.centralStock < item.requestedQuantity && <span className="ml-1 text-xs">⚠</span>}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
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
          <div className="flex gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <Lightbulb size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <span className="font-semibold">Ajusta a envases completos.</span>{' '}
              El sistema muestra el mínimo necesario, pero lo ideal es aprobar en unidades reales de empaque
              (frasco, caja, bolsa, cubeta). Ejemplo: si el sugerido es 200 g de mayonesa,
              aprueba 3,400 g (un frasco completo) para que el vendedor vea los gramos en la etiqueta del envase que se le proporciona.
            </p>
          </div>
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
  const { isAdmin } = useAuth()
  const [quantities, setQuantities] = useState<Record<number, string>>(
    Object.fromEntries(req.items.map((i) => [i.id, '']))
  )
  const [notes, setNotes] = useState('')
  const [coverageReason, setCoverageReason] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => receiveRequisition(req.id, {
      receivedQuantities: Object.fromEntries(
        Object.entries(quantities).map(([k, v]) => [Number(k), parseFloat(v) || 0])
      ),
      receiptNotes: notes || undefined,
      coverageReason: isAdmin && coverageReason.trim() ? coverageReason.trim() : undefined,
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

          {/* Aviso especial cuando es el admin quien recibe en lugar del vendedor */}
          {isAdmin ? (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  <span className="font-semibold">Estás registrando la recepción como administrador.</span>{' '}
                  Normalmente esta acción la realiza el vendedor del carrito.
                  Indica el motivo — este registro queda en auditoría.
                </p>
              </div>
              <input
                value={coverageReason}
                onChange={(e) => setCoverageReason(e.target.value)}
                placeholder="Motivo de cobertura (ej: vendedor ausente por enfermedad) *"
                className="w-full border border-amber-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder:text-amber-400"
              />
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-2 rounded-lg">
              Ingresa las cantidades <strong>físicamente recibidas</strong>. El sistema comparará
              automáticamente con lo despachado y registrará cualquier diferencia.
            </div>
          )}

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

// ── Register merma modal ──────────────────────────────────────────────────────

function RegisterMermaModal({ req, onClose, onDone }: {
  req: RequisitionResponse; onClose: () => void; onDone: () => void
}) {
  const [mermaType, setMermaType] = useState<'FALTANTE' | 'DAÑO' | ''>('')
  const [reason, setReason] = useState('')
  const [error, setError]   = useState('')
  const [deduction, setDeduction] = useState<number | null>(null)

  // Items con diferencia final (usa reconteo si existe)
  const discrepantItems = req.items.filter(i => {
    const fd = i.finalDiscrepancy ?? i.discrepancy
    return fd != null && fd !== 0
  })

  // Valor estimado de la pérdida
  const estimatedValue = discrepantItems.reduce((sum, i) => {
    const qty = i.finalDiscrepancy ?? i.discrepancy ?? 0
    return sum + (qty > 0 ? qty * (i.averageCost ?? 0) : 0)
  }, 0)

  const mut = useMutation({
    mutationFn: () => registerMerma(req.id, { mermaType: mermaType as 'FALTANTE' | 'DAÑO', mermaReason: reason }),
    onSuccess: (data) => {
      onDone()
      if (data.mermaDeductionAmount != null) {
        setDeduction(data.mermaDeductionAmount)
      } else {
        onClose()
      }
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al registrar merma.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-rose-600" />
            <h3 className="font-bold text-slate-800">Registrar merma — {req.cartName}</h3>
          </div>
          <button onClick={deduction != null ? onClose : undefined} className={deduction != null ? '' : 'hidden'}>
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Pantalla de éxito */}
        {deduction != null ? (
          <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle size={44} className="text-rose-500" />
            <div>
              <p className="font-bold text-slate-800 text-base">Merma registrada</p>
              <p className="text-sm text-slate-500 mt-1">El movimiento de pérdida quedó asentado en el inventario.</p>
            </div>
            <div className="w-full bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
              <p className="text-xs text-red-700 font-semibold">Descuento aplicado a tu nómina</p>
              <p className="text-2xl font-bold text-red-600">${deduction.toFixed(2)}</p>
              <p className="text-xs text-red-500">Se registró como descuento en el módulo de nómina a nombre del administrador responsable.</p>
            </div>
            <button onClick={onClose}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold py-2 rounded-lg">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 space-y-4">

              {/* Selector de tipo de merma */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">¿Qué tipo de pérdida es? <span className="text-red-500">*</span></p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMermaType('FALTANTE')}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-colors ${
                      mermaType === 'FALTANTE'
                        ? 'border-red-500 bg-red-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-800">Faltante</span>
                    <span className="text-xs text-slate-500 leading-snug">Mercancía que no llegó. Se le descontará al administrador si tiene nómina.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMermaType('DAÑO')}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-colors ${
                      mermaType === 'DAÑO'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-800">Daño / Descomposición</span>
                    <span className="text-xs text-slate-500 leading-snug">Llegó en mal estado. El negocio absorbe la pérdida, sin descuento a nadie.</span>
                  </button>
                </div>
              </div>

              {/* Aviso de consecuencia según tipo */}
              {mermaType === 'FALTANTE' && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3 py-2.5 rounded-lg space-y-1">
                  <p className="font-semibold">Estás asumiendo responsabilidad como administrador.</p>
                  <p>La pérdida quedará registrada a tu nombre. Si tienes nómina, se le descontará el valor de los faltantes.</p>
                </div>
              )}
              {mermaType === 'DAÑO' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2.5 rounded-lg">
                  <p className="font-semibold">La pérdida impacta al negocio.</p>
                  <p className="mt-0.5">No se genera descuento a ningún empleado. El costo es absorbido por la operación.</p>
                </div>
              )}

              {/* Insumos con diferencia */}
              {discrepantItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-600">Insumos con diferencia:</p>
                  {discrepantItems.map((item) => {
                    const u   = UNIT[item.unitType] ?? item.unitType
                    const qty = item.finalDiscrepancy ?? item.discrepancy ?? 0
                    return (
                      <div key={item.id} className="flex justify-between items-center text-sm py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-700">{item.inventoryItemName}</span>
                        <div className="text-right">
                          <span className="font-semibold text-red-600">-{fmt(qty)} {u}</span>
                          {item.averageCost > 0 && (
                            <p className="text-xs text-slate-400">${(qty * item.averageCost).toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {estimatedValue > 0 && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                      <span className="text-xs font-semibold text-slate-600">Valor estimado total</span>
                      <span className="text-sm font-bold text-red-600">${estimatedValue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Razón de la merma <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={mermaType === 'DAÑO'
                    ? 'ej. Limones podridos, producto caducado, daño en tránsito...'
                    : 'ej. Faltaron 2 kg de carne, robo confirmado por cámara...'}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400 resize-none"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending || !reason.trim() || !mermaType}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg"
              >
                {mut.isPending ? 'Registrando...' : 'Confirmar merma'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Simple action modal (reject / request recount) ────────────────────────────

function SimpleActionModal({ title, description, notesLabel, confirmLabel, confirmClass, required, onClose, onConfirm }: {
  title: string; description: string; notesLabel: string
  confirmLabel: string; confirmClass: string; required: boolean
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
          <label className="text-sm font-medium text-slate-700 block mb-1">
            {notesLabel}{required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" />
        </div>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={handle} disabled={loading || (required && !notes.trim())}
            className={`flex-1 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg ${confirmClass}`}>
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
