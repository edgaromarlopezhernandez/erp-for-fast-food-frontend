import client from './client'
import type { DuePayrollItem, PayrollPaymentRequest, PayrollPaymentResponse } from '../types'

export const getPayrollDueToday = () =>
  client.get<DuePayrollItem[]>('/api/payroll/due').then((r) => r.data)

export const getPayrollPayments = () =>
  client.get<PayrollPaymentResponse[]>('/api/payroll/payments').then((r) => r.data)

export const recordPayrollPayment = (data: PayrollPaymentRequest) =>
  client.post<PayrollPaymentResponse>('/api/payroll/payments', data).then((r) => r.data)
