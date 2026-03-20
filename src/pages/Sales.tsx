import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSales, cancelSale } from '../api/sales'
import { getCarts } from '../api/carts'
import type { Sale } from '../types'
import { XCircle, ChevronDown, ChevronUp } from 'lucide-react'

export default function Sales() {
  const qc = useQueryClient()
  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const [cartFilter, setCartFilter] = useState<number | undefined>()
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', cartFilter],
    queryFn: () => getSales(cartFilter),
  })
  const [expanded, setExpanded] = useState<number | null>(null)

  const cancelMut = useMutation({
    mutationFn: cancelSale,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  })

  const toggle = (id: number) => setExpanded(expanded === id ? null : id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Ventas</h2>
        <select
          value={cartFilter || ''}
          onChange={(e) => setCartFilter(e.target.value ? parseInt(e.target.value) : undefined)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
        >
          <option value="">Todos los carritos</option>
          {carts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Cargando...</div>
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">
          No hay ventas registradas.
        </div>
      ) : (
        <div className="space-y-2">
          {sales.map((sale: Sale) => (
            <div key={sale.id} className={`bg-white rounded-xl border ${
              sale.status === 'CANCELLED' ? 'border-slate-200 opacity-60' : 'border-slate-200'
            }`}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 rounded-xl"
                onClick={() => toggle(sale.id)}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 text-sm">#{sale.id}</span>
                      <span className="text-xs text-slate-400">{sale.cartName}</span>
                      {sale.status === 'CANCELLED' && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          Cancelada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(sale.soldAt).toLocaleString('es-MX')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${sale.status === 'CANCELLED' ? 'line-through text-slate-400' : 'text-green-600'}`}>
                    ${sale.totalAmount.toFixed(2)}
                  </span>
                  {expanded === sale.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {expanded === sale.id && (
                <div className="px-4 pb-4 border-t border-slate-100">
                  <table className="w-full text-sm mt-3">
                    <thead>
                      <tr className="text-xs text-slate-400">
                        <th className="text-left pb-2">Producto</th>
                        <th className="text-center pb-2">Cant.</th>
                        <th className="text-right pb-2">Precio</th>
                        <th className="text-right pb-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sale.items.map((item, i) => (
                        <tr key={i}>
                          <td className="py-1.5 text-slate-700">{item.productName}</td>
                          <td className="py-1.5 text-center text-slate-500">{item.quantity}</td>
                          <td className="py-1.5 text-right text-slate-500">${item.unitPrice.toFixed(2)}</td>
                          <td className="py-1.5 text-right font-medium text-slate-700">${item.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {sale.status === 'COMPLETED' && (
                    <button
                      onClick={() => cancelMut.mutate(sale.id)}
                      disabled={cancelMut.isPending}
                      className="mt-3 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      <XCircle size={14} /> Cancelar venta
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
