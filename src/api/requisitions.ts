import client from './client'

export type RequisitionStatus =
  | 'SOLICITADA' | 'APROBADA' | 'RECHAZADA'
  | 'EN_TRANSITO' | 'COMPLETADO' | 'CON_DISCREPANCIA'

export interface RequisitionItemResponse {
  id: number
  inventoryItemId: number
  inventoryItemName: string
  unitType: string
  requestedQuantity: number
  approvedQuantity: number | null
  dispatchedQuantity: number | null
  receivedQuantity: number | null
  centralStock: number
  discrepancy: number | null
}

export interface RequisitionResponse {
  id: number
  cartId: number
  cartName: string
  requestedByName: string
  approvedByName: string | null
  dispatchedByName: string | null
  receivedByName: string | null
  status: RequisitionStatus
  adminNotes: string | null
  dispatchNotes: string | null
  receiptNotes: string | null
  createdAt: string
  approvedAt: string | null
  dispatchedAt: string | null
  receivedAt: string | null
  items: RequisitionItemResponse[]
}

export const getRequisitions = (status?: RequisitionStatus) =>
  client.get<RequisitionResponse[]>('/api/requisitions', {
    params: status ? { status } : {},
  }).then((r) => r.data)

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
  data: { receivedQuantities: Record<number, number>; receiptNotes?: string },
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
  items: BlindReceiptItem[]
}

/** Returns the EN_TRANSITO requisition for the seller's cart (no dispatched quantities). */
export const getPendingReceipt = (cartId?: number | null) =>
  client.get<BlindRequisitionResponse>('/api/requisitions/pending-receipt', {
    params: cartId ? { cartId } : {},
  }).then((r) => r.data)
