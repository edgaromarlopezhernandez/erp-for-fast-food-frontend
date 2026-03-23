import client from './client'
import type { ProductModifierGroup, ProductModifierGroupRequest } from '../types'

export const getModifierGroups = (productId: number) =>
  client.get<ProductModifierGroup[]>('/api/modifier-groups', { params: { productId } }).then(r => r.data)

export const createModifierGroup = (data: ProductModifierGroupRequest) =>
  client.post<ProductModifierGroup>('/api/modifier-groups', data).then(r => r.data)

export const updateModifierGroup = (id: number, data: ProductModifierGroupRequest) =>
  client.put<ProductModifierGroup>(`/api/modifier-groups/${id}`, data).then(r => r.data)

export const deleteModifierGroup = (id: number) =>
  client.delete(`/api/modifier-groups/${id}`)
