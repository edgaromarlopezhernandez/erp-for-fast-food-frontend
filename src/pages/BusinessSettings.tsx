import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Pencil, Save, X, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react'
import { getTenantProfile, updateTenantProfile } from '../api/tenant'
import type { SubscriptionStatus } from '../types'

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  TRIAL: {
    label: 'Período de prueba',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Clock size={16} />,
  },
  ACTIVE: {
    label: 'Subscripción activa',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle size={16} />,
  },
  EXPIRED: {
    label: 'Subscripción expirada',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: <AlertCircle size={16} />,
  },
  SUSPENDED: {
    label: 'Cuenta suspendida',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: <XCircle size={16} />,
  },
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BusinessSettings() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tenant-profile'],
    queryFn: getTenantProfile,
  })

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [editingWhatsapp, setEditingWhatsapp] = useState(false)
  const [whatsappInput, setWhatsappInput] = useState('')

  const mutation = useMutation({
    mutationFn: updateTenantProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-profile'] })
      setEditingName(false)
      setEditingWhatsapp(false)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500">
        Cargando...
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-40 text-red-500">
        Error al cargar los datos del negocio.
      </div>
    )
  }

  const status = STATUS_CONFIG[data.subscriptionStatus]

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 size={24} className="text-violet-600" />
        <h1 className="text-xl font-bold text-slate-800">Mi Negocio</h1>
      </div>

      {/* Subscription card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Subscripción</h2>

        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${status.color}`}>
          {status.icon}
          {status.label}
        </div>

        {data.subscriptionStatus === 'TRIAL' && data.trialEndsAt && (
          <p className="text-sm text-slate-600">
            Tu período de prueba termina el{' '}
            <span className="font-semibold">{fmtDate(data.trialEndsAt)}</span>.
          </p>
        )}

        {data.subscriptionStatus === 'EXPIRED' && (
          <p className="text-sm text-red-600">
            Tu período de prueba ha terminado. Contacta a soporte para activar tu subscripción.
          </p>
        )}

        {data.subscriptionStatus === 'SUSPENDED' && (
          <p className="text-sm text-yellow-700">
            Tu cuenta está suspendida. Contacta a soporte para reactivarla.
          </p>
        )}

        {data.subscriptionStatus === 'ACTIVE' && (
          <p className="text-sm text-green-700">
            Tu subscripción está al día.
          </p>
        )}
      </div>

      {/* Business data card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Datos del negocio</h2>

        {/* Name */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Nombre del negocio</label>
          {editingName ? (
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                autoFocus
                placeholder={data.name}
              />
              <button
                onClick={() => mutation.mutate({ name: nameInput })}
                disabled={!nameInput.trim() || mutation.isPending}
                className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="p-2 border border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{data.name}</span>
              <button
                onClick={() => { setNameInput(data.name); setEditingName(true) }}
                className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
              >
                <Pencil size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Slug (read-only) */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Identificador único (slug)</label>
          <span className="text-sm text-slate-500 font-mono">{data.slug}</span>
        </div>

        {/* WhatsApp */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">WhatsApp del dueño</label>
          {editingWhatsapp ? (
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                value={whatsappInput}
                onChange={e => setWhatsappInput(e.target.value)}
                autoFocus
                placeholder="52 55 1234 5678"
              />
              <button
                onClick={() => mutation.mutate({ ownerWhatsapp: whatsappInput })}
                disabled={mutation.isPending}
                className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => setEditingWhatsapp(false)}
                className="p-2 border border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">
                {data.ownerWhatsapp || <span className="text-slate-400 italic">Sin registrar</span>}
              </span>
              <button
                onClick={() => { setWhatsappInput(data.ownerWhatsapp ?? ''); setEditingWhatsapp(true) }}
                className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
              >
                <Pencil size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          Error al guardar los cambios.
        </p>
      )}
    </div>
  )
}