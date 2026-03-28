import client from './client'
import type { FinancialReport, ProductProfitability, CommercialKpis, TopSellerTrend, DailySummary } from '../types'

export const getFinancialReport = (year: number, month: number, cartId?: number) =>
  client.get<FinancialReport>('/api/reports/financial', {
    params: { year, month, ...(cartId ? { cartId } : {}) },
  }).then((r) => r.data)

export interface StartPeriod { startYear: number; startMonth: number }
export const getStartPeriod = () =>
  client.get<StartPeriod>('/api/reports/start-period').then((r) => r.data)

export const getProductProfitability = () =>
  client.get<ProductProfitability[]>('/api/reports/product-profitability').then((r) => r.data)

export const getCommercialKpis = (year: number, month: number, cartId?: number) =>
  client.get<CommercialKpis>('/api/reports/commercial-kpis', {
    params: { year, month, ...(cartId ? { cartId } : {}) },
  }).then((r) => r.data)

export const getTopSellerTrend = (months = 6, cartId?: number) =>
  client.get<TopSellerTrend>('/api/reports/top-seller-trend', {
    params: { months, ...(cartId ? { cartId } : {}) },
  }).then((r) => r.data)

export const getDailySummary = (cartId?: number) =>
  client.get<DailySummary>('/api/reports/today-summary', {
    params: { ...(cartId ? { cartId } : {}) },
  }).then((r) => r.data)
