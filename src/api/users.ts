import client from './client'
import type { UserResponse, UserRequest } from '../types'

export const getMe = () =>
  client.get<UserResponse>('/api/users/me').then((r) => r.data)
export const getUsers = () =>
  client.get<UserResponse[]>('/api/users').then((r) => r.data)
export const createUser = (data: UserRequest) =>
  client.post<UserResponse>('/api/users', data).then((r) => r.data)
export const updateEmployee = (id: number, data: UserRequest) =>
  client.put<UserResponse>(`/api/users/${id}`, data).then((r) => r.data)
export const assignCart = (userId: number, cartId: number | null) =>
  client.patch<UserResponse>(`/api/users/${userId}/cart`, { cartId }).then((r) => r.data)

export const updatePayroll = (userId: number, salary: number | null, payrollPeriod: string | null) =>
  client.patch<UserResponse>(`/api/users/${userId}/payroll`, { salary, payrollPeriod }).then((r) => r.data)
export interface DeactivationResponse {
  user: UserResponse
  payrollCutAmount: number | null
  payrollPeriodLabel: string | null
}
export const deactivateUser = (id: number) =>
  client.delete<DeactivationResponse>(`/api/users/${id}`).then((r) => r.data)
export const reactivateUser = (id: number) =>
  client.patch(`/api/users/${id}/activate`)
