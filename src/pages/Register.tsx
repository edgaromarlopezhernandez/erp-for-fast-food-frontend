import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerApi } from '../api/auth'
import { Store } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    businessName: '', businessSlug: '', name: '', username: '', password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await registerApi(form)
      navigate('/login')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Error al registrar el negocio')
    } finally {
      setLoading(false)
    }
  }

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form]}
        onChange={set(key)}
        placeholder={placeholder}
        required
        className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm border border-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-violet-600 p-3 rounded-2xl mb-3">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Registra tu negocio</h1>
          <p className="text-slate-400 text-sm mt-1">Empieza a controlar tus ventas</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {field('Nombre del negocio', 'businessName', 'text', 'Elotes El Chavo')}
          {field('Identificador (slug)', 'businessSlug', 'text', 'elotes-el-chavo')}
          <hr className="border-slate-700" />
          {field('Tu nombre', 'name', 'text', 'Edgar')}
          {field('Usuario (admin)', 'username', 'text', 'edgar')}
          {field('Contraseña', 'password', 'password', '••••••••')}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-violet-400 hover:text-violet-300">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
