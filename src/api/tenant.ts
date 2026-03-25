import client from './client'
import type { TenantProfile, TenantProfileRequest } from '../types'

export const getTenantProfile = () =>
  client.get<TenantProfile>('/api/tenant/me').then(r => r.data)

export const updateTenantProfile = (data: TenantProfileRequest) =>
  client.patch<TenantProfile>('/api/tenant/me', data).then(r => r.data)