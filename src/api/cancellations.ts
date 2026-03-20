import client from './client'
import type { CancellationRequest, CancellationRequestCreate, CancellationRequestReview, CancellationRequestStatus } from '../types'

export const requestCancellation = (data: CancellationRequestCreate) =>
  client.post<CancellationRequest>('/api/cancellation-requests', data).then((r) => r.data)

export const getMyCancellationRequests = () =>
  client.get<CancellationRequest[]>('/api/cancellation-requests/mine').then((r) => r.data)

export const getCancellationRequests = (status?: CancellationRequestStatus) =>
  client.get<CancellationRequest[]>('/api/cancellation-requests', { params: status ? { status } : {} }).then((r) => r.data)

export const approveCancellation = (id: number, data?: CancellationRequestReview) =>
  client.post<CancellationRequest>(`/api/cancellation-requests/${id}/approve`, data ?? {}).then((r) => r.data)

export const rejectCancellation = (id: number, data?: CancellationRequestReview) =>
  client.post<CancellationRequest>(`/api/cancellation-requests/${id}/reject`, data ?? {}).then((r) => r.data)
