import client from './client'
import type { InventoryItem, InventoryItemRequest, InventoryMovement, StockAdjustmentRequest } from '../types'

export interface TransferLine { inventoryItemId: number; quantity: number }
export interface TransferToCartRequest { cartId: number; items: TransferLine[]; notes?: string }

export interface CartItemAnalysis {
  inventoryItemId: number
  name: string
  unitType: string
  currentCartStock: number
  avgDailyConsumption: number
  estimatedDaysRemaining: number | null
  /** 'CRITICAL' | 'LOW' | 'OK' | 'NO_DATA' */
  status: string
}
export interface CartStockAnalysis {
  cartId: number
  cartName: string
  windowDays: number
  items: CartItemAnalysis[]
}

// cartId: undefined = bodega general | N = stock del carrito N
export const getInventory = (cartId?: number) =>
  client.get<InventoryItem[]>('/api/inventory', {
    params: cartId !== undefined ? { cartId } : {},
  }).then((r) => r.data)

export const getInventoryItem = (id: number) =>
  client.get<InventoryItem>(`/api/inventory/${id}`).then((r) => r.data)
export const createInventoryItem = (data: InventoryItemRequest) =>
  client.post<InventoryItem>('/api/inventory', data).then((r) => r.data)
export const updateInventoryItem = (id: number, data: InventoryItemRequest) =>
  client.put<InventoryItem>(`/api/inventory/${id}`, data).then((r) => r.data)
export const adjustStock = (data: StockAdjustmentRequest) =>
  client.post<InventoryItem>('/api/inventory/adjust', data).then((r) => r.data)
export const transferToCart = (data: TransferToCartRequest) =>
  client.post('/api/inventory/transfer', data)
export const getMovements = (itemId: number) =>
  client.get<InventoryMovement[]>(`/api/inventory/${itemId}/movements`).then((r) => r.data)
export const deleteInventoryItem = (id: number) =>
  client.delete(`/api/inventory/${id}`)

export const getCartStockAnalysis = (cartId: number, windowDays = 30) =>
  client.get<CartStockAnalysis>('/api/inventory/cart-analysis', {
    params: { cartId, windowDays },
  }).then((r) => r.data)

export interface ReconcileItem { inventoryItemId: number; physicalCount: number; cartId?: number }
export interface ReconcileRequest { items: ReconcileItem[]; notes?: string }

export const reconcileStock = (data: ReconcileRequest) =>
  client.post<import('../types').InventoryItem[]>('/api/inventory/reconcile', data).then((r) => r.data)
