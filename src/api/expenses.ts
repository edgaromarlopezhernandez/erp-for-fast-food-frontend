import client from './client'

export interface ExpenseResponse {
  id: number
  date: string
  amount: number
  description: string
  category?: string
  notes?: string
  cartId?: number
  cartName?: string
  createdByName?: string
}

export interface ExpenseRequest {
  date: string
  amount: number
  description: string
  category?: string
  notes?: string
  cartId?: number   // undefined = general, 0 = filtro "solo generales", N = carrito específico
}

// cartId: undefined = todos | 0 = solo generales | N = carrito específico
export const getExpenses = (year: number, month: number, cartId?: number) =>
  client.get<ExpenseResponse[]>('/api/expenses', {
    params: { year, month, ...(cartId !== undefined ? { cartId } : {}) },
  }).then((r) => r.data)

export const createExpense = (req: ExpenseRequest) =>
  client.post<ExpenseResponse>('/api/expenses', req).then((r) => r.data)

export const updateExpense = (id: number, req: ExpenseRequest) =>
  client.put<ExpenseResponse>(`/api/expenses/${id}`, req).then((r) => r.data)

export const deleteExpense = (id: number) =>
  client.delete(`/api/expenses/${id}`)
