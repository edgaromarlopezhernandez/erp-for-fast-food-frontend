import client from './client'
import type { CashAccount, GeneralCashRegisterResponse, WithdrawalRequest, WithdrawalResponse, CashDepositRequest, CashDepositResponse } from '../types'

export const getCashAccount = () =>
  client.get<CashAccount>('/api/cash-account').then(r => r.data)

export const setInitialCapital = (amount: number) =>
  client.patch('/api/cash-account/initial-capital', { amount }).then(r => r.data)

export const createWithdrawal = (data: WithdrawalRequest) =>
  client.post<WithdrawalResponse>('/api/cash-account/withdrawals', data).then(r => r.data)

export const deleteWithdrawal = (id: number) =>
  client.delete(`/api/cash-account/withdrawals/${id}`).then(r => r.data)

export const createDeposit = (data: CashDepositRequest) =>
  client.post<CashDepositResponse>('/api/cash-account/deposits', data).then(r => r.data)

export const deleteDeposit = (id: number) =>
  client.delete(`/api/cash-account/deposits/${id}`).then(r => r.data)

export const getGeneralRegister = () =>
  client.get<GeneralCashRegisterResponse>('/api/cash-account/general-register').then(r => r.data)