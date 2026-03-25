import client from './client'
import type { PurchaseOrder, PurchaseOrderRequest, PurchaseSuggestion } from '../types'

export const getPurchaseOrders = () =>
  client.get<PurchaseOrder[]>('/api/purchase-orders').then((r) => r.data)

export const getPurchaseOrder = (id: number) =>
  client.get<PurchaseOrder>(`/api/purchase-orders/${id}`).then((r) => r.data)

export const createPurchaseOrder = (data: PurchaseOrderRequest) =>
  client.post<PurchaseOrder>('/api/purchase-orders', data).then((r) => r.data)

export const confirmPurchaseOrder = (id: number) =>
  client.post<PurchaseOrder>(`/api/purchase-orders/${id}/confirm`).then((r) => r.data)

export const cancelPurchaseOrder = (id: number) =>
  client.post<PurchaseOrder>(`/api/purchase-orders/${id}/cancel`).then((r) => r.data)

export const updatePurchaseOrder = (id: number, data: PurchaseOrderRequest) =>
  client.patch<PurchaseOrder>(`/api/purchase-orders/${id}`, data).then((r) => r.data)

export const getPurchaseSuggestions = (windowDays = 30, targetDays = 30) =>
  client
    .get<PurchaseSuggestion>('/api/purchase-orders/suggestions', {
      params: { windowDays, targetDays },
    })
    .then((r) => r.data)
