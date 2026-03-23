import client from './client'
import type { FinancialReport, ProductProfitability } from '../types'

export const getFinancialReport = (year: number, month: number, cartId?: number) =>
  client.get<FinancialReport>('/api/reports/financial', {
    params: { year, month, ...(cartId ? { cartId } : {}) },
  }).then((r) => r.data)

export interface StartPeriod { startYear: number; startMonth: number }
export const getStartPeriod = () =>
  client.get<StartPeriod>('/api/reports/start-period').then((r) => r.data)

export const getProductProfitability = () =>
  client.get<ProductProfitability[]>('/api/reports/product-profitability').then((r) => r.data)
