import client from './client'

export type RequisitionStatus =
  | 'SOLICITADA' | 'APROBADA' | 'RECHAZADA'
  | 'EN_TRANSITO' | 'COMPLETADO' | 'CON_DISCREPANCIA'
  | 'RECONTEO_SOLICITADO' | 'MERMA_REGISTRADA'

export type MermaType = 'FALTANTE' | 'DAÑO'

export interface RequisitionItemResponse {
  id: number
  inventoryItemId: number
  inventoryItemName: string
  unitType: string
  requestedQuantity: number
  approvedQuantity: number | null
  dispatchedQuantity: number | null
  receivedQuantity: number | null
  recountQuantity: number | null
  centralStock: number
  averageCost: number
  discrepancy: number | null
  finalDiscrepancy: number | null
}

export interface RequisitionResponse {
  id: number
  cartId: number
  cartName: string
  requestedByName: string
  approvedByName: string | null
  dispatchedByName: string | null
  receivedByName: string | null
  adminCoverageReceive: boolean
  adminCoverageReason: string | null
  status: RequisitionStatus
  adminNotes: string | null
  dispatchNotes: string | null
  receiptNotes: string | null
  createdAt: string
  approvedAt: string | null
  dispatchedAt: string | null
  receivedAt: string | null
  // Reconteo
  recountRequestedByName: string | null
  recountRequestedAt: string | null
  recountNotes: string | null
  // Merma
  mermaType: MermaType | null
  mermaRegisteredByName: string | null
  mermaRegisteredAt: string | null
  mermaReason: string | null
  mermaDeductionAmount: number | null
  items: RequisitionItemResponse[]
}

export const getRequisitions = (opts?: { status?: RequisitionStatus; year?: number; month?: number }) =>
  client.get<RequisitionResponse[]>('/api/requisitions', {
    params: { ...opts },
  }).then((r) => r.data)

export const getRequisitionMonths = () =>
  client.get<string[]>('/api/requisitions/months').then((r) => r.data)

export const getRequisitionsByCart = (cartId: number) =>
  client.get<RequisitionResponse[]>(`/api/requisitions/cart/${cartId}`).then((r) => r.data)

export const getRequisition = (id: number) =>
  client.get<RequisitionResponse>(`/api/requisitions/${id}`).then((r) => r.data)

export const autoGenerate = (cartId: number) =>
  client.post<RequisitionResponse>('/api/requisitions/auto-generate', null, {
    params: { cartId },
  }).then((r) => r.data)

export const approveRequisition = (
  id: number,
  data: { approvedQuantities: Record<number, number>; adminNotes?: string },
) => client.post<RequisitionResponse>(`/api/requisitions/${id}/approve`, data).then((r) => r.data)

export const rejectRequisition = (id: number, data: { adminNotes?: string }) =>
  client.post<RequisitionResponse>(`/api/requisitions/${id}/reject`, data).then((r) => r.data)

export const dispatchRequisition = (id: number, data: { dispatchNotes?: string }) =>
  client.post<RequisitionResponse>(`/api/requisitions/${id}/dispatch`, data).then((r) => r.data)

export const receiveRequisition = (
  id: number,
  data: { receivedQuantities: Record<number, number>; receiptNotes?: string; coverageReason?: string },
) => client.post<RequisitionResponse>(`/api/requisitions/${id}/receive`, data).then((r) => r.data)

// ── Blind receipt (seller view) ──────────────────────────────────────────────

export interface BlindReceiptItem {
  id: number
  inventoryItemId: number
  inventoryItemName: string
  unitType: string
}

export interface BlindRequisitionResponse {
  id: number
  cartId: number
  cartName: string
  status: RequisitionStatus
  dispatchNotes: string | null
  dispatchedAt: string | null
  recountNotes: string | null
  items: BlindReceiptItem[]
}

/** Returns the EN_TRANSITO or RECONTEO_SOLICITADO requisition for the seller's cart. */
export const getPendingReceipt = (cartId?: number | null) =>
  client.get<BlindRequisitionResponse>('/api/requisitions/pending-receipt', {
    params: cartId ? { cartId } : {},
  }).then((r) => r.data)

// ── Discrepancy resolution ────────────────────────────────────────────────────

export const requestRecount = (id: number, data: { recountNotes?: string }) =>
  client.post<RequisitionResponse>(`/api/requisitions/${id}/request-recount`, data).then((r) => r.data)

export const submitRecount = (
  id: number,
  data: { recountQuantities: Record<number, number>; recountNotes?: string },
) => client.post<RequisitionResponse>(`/api/requisitions/${id}/submit-recount`, data).then((r) => r.data)

export const registerMerma = (
  id: number,
  data: { mermaType: MermaType; mermaReason: string },
) => client.post<RequisitionResponse>(`/api/requisitions/${id}/register-merma`, data).then((r) => r.data)
