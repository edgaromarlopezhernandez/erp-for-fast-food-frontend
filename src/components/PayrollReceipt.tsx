import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPaymentDetail } from '../api/payroll'
import { X, Printer } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

interface Props {
  paymentId: number
  businessName?: string
  onClose: () => void
}

export default function PayrollReceipt({ paymentId, businessName, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['payroll-receipt', paymentId],
    queryFn: () => getPaymentDetail(paymentId),
  })

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Recibo de nómina</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
            .header { text-align: center; margin-bottom: 16px; }
            .header h1 { font-size: 16px; font-weight: bold; }
            .header p { font-size: 12px; color: #555; margin-top: 2px; }
            .section { margin-bottom: 12px; }
            .section-title { font-size: 11px; text-transform: uppercase; color: #777; letter-spacing: 0.05em; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .row .label { color: #444; }
            .row .value { font-weight: 600; }
            .row.bonus .value { color: #15803d; }
            .row.deduction .value { color: #b91c1c; }
            .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 2px solid #111; padding-top: 8px; margin-top: 4px; }
            .signature { margin-top: 32px; border-top: 1px solid #111; padding-top: 8px; font-size: 12px; text-align: center; color: #555; }
            .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Recibo de nómina</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Receipt preview */}
        <div className="p-5 max-h-[75vh] overflow-y-auto">
          {isLoading ? (
            <p className="text-center text-slate-400 py-8 text-sm">Cargando recibo...</p>
          ) : data ? (
            <ReceiptContent ref={printRef} data={data} businessName={businessName} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

import { forwardRef } from 'react'
import type { PayrollPaymentResponse } from '../types'

const ReceiptContent = forwardRef<HTMLDivElement, { data: PayrollPaymentResponse; businessName?: string }>(
  ({ data, businessName }, ref) => {
    const bonuses = (data.appliedIncidences ?? []).filter(i => i.type === 'BONUS')
    const deductions = (data.appliedIncidences ?? []).filter(i => i.type === 'DEDUCTION')
    const bonusTotal = bonuses.reduce((s, i) => s + i.amount, 0)
    const deductionTotal = deductions.reduce((s, i) => s + i.amount, 0)
    const base = data.baseAmount ?? (data.amount - bonusTotal + deductionTotal)

    const paidDateStr = data.paidDate
      ? new Date(data.paidDate + 'T12:00:00').toLocaleDateString('es-MX', {
          day: '2-digit', month: 'long', year: 'numeric',
        })
      : '—'

    return (
      <div ref={ref} className="font-mono text-sm space-y-4 text-slate-800">
        {/* Header */}
        <div className="header text-center space-y-0.5">
          <p className="text-base font-bold">{businessName ?? 'Negocio'}</p>
          <p className="text-xs text-slate-500">Recibo de Nómina</p>
        </div>

        {/* Employee & period */}
        <div className="section space-y-1">
          <p className="section-title text-[10px] uppercase text-slate-400 border-b border-slate-200 pb-1 mb-2">
            Empleado
          </p>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Nombre</span>
            <span className="font-semibold">{data.employeeName}</span>
          </div>
          {data.cartName && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Punto de venta</span>
              <span className="font-semibold">{data.cartName}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Periodo</span>
            <span className="font-semibold text-right max-w-[55%]">{data.periodLabel}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Fecha de pago</span>
            <span className="font-semibold">{paidDateStr}</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="section space-y-1">
          <p className="text-[10px] uppercase text-slate-400 border-b border-slate-200 pb-1 mb-2">
            Detalle
          </p>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Sueldo base</span>
            <span>{fmt(base)}</span>
          </div>
          {bonuses.map(b => (
            <div key={b.id} className="flex justify-between text-xs">
              <span className="text-slate-500">{b.concept}</span>
              <span className="text-emerald-700 font-medium">+{fmt(b.amount)}</span>
            </div>
          ))}
          {deductions.map(d => (
            <div key={d.id} className="flex justify-between text-xs">
              <span className="text-slate-500">{d.concept}</span>
              <span className="text-red-600 font-medium">-{fmt(d.amount)}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t-2 border-slate-800 pt-2">
          <div className="flex justify-between font-bold text-base">
            <span>TOTAL</span>
            <span>{fmt(data.amount)}</span>
          </div>
        </div>

        {data.notes && (
          <p className="text-xs text-slate-400 italic">{data.notes}</p>
        )}

        {/* Signature */}
        <div className="mt-8 pt-6 border-t border-slate-300 text-center space-y-1">
          <p className="text-xs text-slate-500">Recibí conforme</p>
          <div className="h-8" />
          <div className="border-t border-slate-400 w-48 mx-auto" />
          <p className="text-xs text-slate-500">Firma del empleado</p>
        </div>
      </div>
    )
  }
)

ReceiptContent.displayName = 'ReceiptContent'