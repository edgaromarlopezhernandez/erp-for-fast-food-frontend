import client from './client'
import type { ShiftCountItem, ShiftCountEntry, ShiftCountSummaryItem } from '../types'

/** Admin: items a contar en apertura (incluye stock actual del carrito) */
export const getOpeningCountItems = (shiftId: number) =>
  client.get<ShiftCountItem[]>(`/api/shifts/${shiftId}/count/opening/items`).then(r => r.data)

/** Admin: registrar conteo de apertura */
export const saveOpeningCount = (shiftId: number, items: ShiftCountEntry[]) =>
  client.post(`/api/shifts/${shiftId}/count/opening`, { items }).then(r => r.data)

/** Empleado: items a contar en cierre (sin stock esperado) */
export const getClosingCountItems = (shiftId: number) =>
  client.get<ShiftCountItem[]>(`/api/shifts/${shiftId}/count/closing/items`).then(r => r.data)

/** Empleado: registrar conteo de cierre */
export const saveClosingCount = (shiftId: number, items: ShiftCountEntry[]) =>
  client.post(`/api/shifts/${shiftId}/count/closing`, { items }).then(r => r.data)

/** Admin: resumen de discrepancias del turno */
export const getCountSummary = (shiftId: number) =>
  client.get<ShiftCountSummaryItem[]>(`/api/shifts/${shiftId}/count/summary`).then(r => r.data)