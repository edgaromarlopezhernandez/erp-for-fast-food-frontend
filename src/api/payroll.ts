import client from './client'
import type {
  DuePayrollItem, PayrollPaymentRequest, PayrollPaymentResponse,
  PayrollIncidenceRequest, PayrollIncidenceResponse,
  PayrollGoalRequest, PayrollGoalResponse,
} from '../types'

// ── Pagos ─────────────────────────────────────────────────────────────────────

export const getPayrollDueToday = () =>
  client.get<DuePayrollItem[]>('/api/payroll/due').then(r => r.data)

export const getPayrollPayments = (employeeId?: number) =>
  client.get<PayrollPaymentResponse[]>('/api/payroll/payments', {
    params: employeeId ? { employeeId } : undefined,
  }).then(r => r.data)

export const getPaymentDetail = (id: number) =>
  client.get<PayrollPaymentResponse>(`/api/payroll/payments/${id}`).then(r => r.data)

export const recordPayrollPayment = (data: PayrollPaymentRequest) =>
  client.post<PayrollPaymentResponse>('/api/payroll/payments', data).then(r => r.data)

// ── Incidencias ───────────────────────────────────────────────────────────────

export const getIncidences = (employeeId?: number) =>
  client.get<PayrollIncidenceResponse[]>('/api/payroll/incidences', {
    params: employeeId ? { employeeId } : undefined,
  }).then(r => r.data)

export const createIncidence = (data: PayrollIncidenceRequest) =>
  client.post<PayrollIncidenceResponse>('/api/payroll/incidences', data).then(r => r.data)

export const deleteIncidence = (id: number) =>
  client.delete(`/api/payroll/incidences/${id}`).then(r => r.data)

// ── Metas ─────────────────────────────────────────────────────────────────────

export const getGoals = () =>
  client.get<PayrollGoalResponse[]>('/api/payroll/goals').then(r => r.data)

export const upsertGoal = (data: PayrollGoalRequest) =>
  client.post<PayrollGoalResponse>('/api/payroll/goals', data).then(r => r.data)

export const deleteGoal = (id: number) =>
  client.delete(`/api/payroll/goals/${id}`).then(r => r.data)