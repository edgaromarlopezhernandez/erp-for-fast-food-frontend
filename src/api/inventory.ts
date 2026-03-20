import client from './client'
import type { InventoryItem, InventoryItemRequest, InventoryMovement, StockAdjustmentRequest } from '../types'

export const getInventory = () =>
  client.get<InventoryItem[]>('/api/inventory').then((r) => r.data)
export const getInventoryItem = (id: number) =>
  client.get<InventoryItem>(`/api/inventory/${id}`).then((r) => r.data)
export const createInventoryItem = (data: InventoryItemRequest) =>
  client.post<InventoryItem>('/api/inventory', data).then((r) => r.data)
export const updateInventoryItem = (id: number, data: InventoryItemRequest) =>
  client.put<InventoryItem>(`/api/inventory/${id}`, data).then((r) => r.data)
export const adjustStock = (data: StockAdjustmentRequest) =>
  client.post<InventoryItem>('/api/inventory/adjust', data).then((r) => r.data)
export const getMovements = (itemId: number) =>
  client.get<InventoryMovement[]>(`/api/inventory/${itemId}/movements`).then((r) => r.data)
export const deleteInventoryItem = (id: number) =>
  client.delete(`/api/inventory/${id}`)
