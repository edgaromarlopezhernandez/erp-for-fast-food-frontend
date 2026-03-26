import client from './client'
import type { ProductionTemplateResponse, ProductionTemplateRequest } from '../types'

export const listProductionTemplates = () =>
  client.get<ProductionTemplateResponse[]>('/api/production-templates').then((r) => r.data)

export const getProductionTemplate = (id: number) =>
  client.get<ProductionTemplateResponse>(`/api/production-templates/${id}`).then((r) => r.data)

export const createProductionTemplate = (data: ProductionTemplateRequest) =>
  client.post<ProductionTemplateResponse>('/api/production-templates', data).then((r) => r.data)

export const updateProductionTemplate = (id: number, data: ProductionTemplateRequest) =>
  client.put<ProductionTemplateResponse>(`/api/production-templates/${id}`, data).then((r) => r.data)

export const archiveProductionTemplate = (id: number) =>
  client.delete(`/api/production-templates/${id}`)