import client from './client'
import type { Shift, OpenShiftRequest, CloseShiftRequest, ShiftReview, ShiftStatus, AttendanceSummary } from '../types'

export const openShift = (data: OpenShiftRequest) =>
  client.post<Shift>('/api/shifts/open', data).then((r) => r.data)
export const closeShift = (data: CloseShiftRequest) =>
  client.post<Shift>('/api/shifts/close', data).then((r) => r.data)
export const getMyShift = () =>
  client.get<Shift>('/api/shifts/mine').then((r) => r.data).catch(() => null)
export const getShifts = (status?: ShiftStatus) =>
  client.get<Shift[]>('/api/shifts', { params: status ? { status } : {} }).then((r) => r.data)
export const approveShift = (id: number, data?: ShiftReview) =>
  client.post<Shift>(`/api/shifts/${id}/approve`, data ?? {}).then((r) => r.data)
export const returnShift = (id: number, data?: ShiftReview) =>
  client.post<Shift>(`/api/shifts/${id}/return`, data ?? {}).then((r) => r.data)
export const getMyAttendance = () =>
  client.get<AttendanceSummary>('/api/attendance/mine').then((r) => r.data)
export const getEmployeeAttendance = (employeeId: number) =>
  client.get<AttendanceSummary>(`/api/attendance/${employeeId}`).then((r) => r.data)
