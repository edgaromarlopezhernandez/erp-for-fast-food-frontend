import client from './client'
import type { Sale, SaleRequest, SendTicketRequest, SendTicketResponse } from '../types'

export const registerSale = (data: SaleRequest) =>
  client.post<Sale>('/api/sales', data).then((r) => r.data)
export const cancelSale = (id: number) =>
  client.post<Sale>(`/api/sales/${id}/cancel`).then((r) => r.data)
export const getSales = (cartId?: number) =>
  client.get<Sale[]>('/api/sales', { params: cartId ? { cartId } : {} }).then((r) => r.data)
export const getSale = (id: number) =>
  client.get<Sale>(`/api/sales/${id}`).then((r) => r.data)
export const getMySales = () =>
  client.get<Sale[]>('/api/sales/mine').then((r) => r.data)
export const sendTicket = (saleId: number, data: SendTicketRequest) =>
  client.post<SendTicketResponse>(`/api/sales/${saleId}/send-ticket`, data).then((r) => r.data)
