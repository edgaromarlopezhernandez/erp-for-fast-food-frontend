import api from './client'
import type { ProductionResponse, ProductionRequest } from '../types'

export const listProductions = (): Promise<ProductionResponse[]> =>
  api.get('/api/productions').then(r => r.data)

export const getProduction = (id: number): Promise<ProductionResponse> =>
  api.get(`/api/productions/${id}`).then(r => r.data)

export const createProduction = (data: ProductionRequest): Promise<ProductionResponse> =>
  api.post('/api/productions', data).then(r => r.data)

export const confirmProduction = (id: number): Promise<ProductionResponse> =>
  api.post(`/api/productions/${id}/confirm`).then(r => r.data)

export const deleteProduction = (id: number): Promise<void> =>
  api.delete(`/api/productions/${id}`)
