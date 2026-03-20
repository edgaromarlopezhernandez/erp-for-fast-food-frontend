import client from './client'
import type { FinancialReport } from '../types'

export const getFinancialReport = (year: number, month: number, cartId?: number) =>
  client.get<FinancialReport>('/api/reports/financial', {
    params: { year, month, ...(cartId ? { cartId } : {}) },
  }).then((r) => r.data)
