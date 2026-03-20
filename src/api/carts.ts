import client from './client'
import type { Cart, CartRequest } from '../types'

export const getCarts = () =>
  client.get<Cart[]>('/api/carts').then((r) => r.data)
export const createCart = (data: CartRequest) =>
  client.post<Cart>('/api/carts', data).then((r) => r.data)
export const updateCart = (id: number, data: CartRequest) =>
  client.put<Cart>(`/api/carts/${id}`, data).then((r) => r.data)
export const deleteCart = (id: number) =>
  client.delete(`/api/carts/${id}`)
export const reactivateCart = (id: number) =>
  client.patch<Cart>(`/api/carts/${id}/reactivate`).then((r) => r.data)
