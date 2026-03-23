import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProducts } from '../api/products'
import { getCarts } from '../api/carts'
import { registerSale, getMySales, sendTicket } from '../api/sales'
import { getAllRecipes } from '../api/recipes'
import { getMe } from '../api/users'
import { getMyCancellationRequests, requestCancellation } from '../api/cancellations'
import { getMyShift, openShift, closeShift, getMyAttendance } from '../api/shifts'
import { getRequisitionsByCart, receiveRequisition } from '../api/requisitions'
import { getModifierGroups } from '../api/modifiers'
import type { RequisitionResponse } from '../api/requisitions'
import type { Product, Sale, SaleItemRequest, SendTicketResponse, Recipe, RecipeExtra, ProductModifierGroup } from '../types'

import {
  ShoppingCart, Trash2, CheckCircle, LogOut, Minus, Plus,
  Warehouse, ChevronDown, ChevronUp, XCircle, Clock, X, DollarSign, Lock, MessageCircle, Sparkles,
  PackageCheck, Truck, ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useNavigate } from 'react-router-dom'

interface SelectedExtraLine { recipeExtraId: number; name: string; extraPrice: number; inventoryItemId: number; quantityRequired: number }
interface ExclusionLine { inventoryItemId: number; name: string }
interface SelectedModifierLine { modifierId: number; groupId: number; modifierGroupName: string; modifierName: string; priceAdjustment: number }
interface CartLine {
  product: Product
  quantity: number
  extras: SelectedExtraLine[]
  exclusions: ExclusionLine[]
  modifiers: SelectedModifierLine[]
  lineKey: string
}

function computeLineKey(productId: number, extras: SelectedExtraLine[], exclusions: ExclusionLine[], modifiers: SelectedModifierLine[]) {
  const xk = [...extras].sort((a, b) => a.recipeExtraId - b.recipeExtraId).map(e => e.recipeExtraId).join(',')
  const ek = [...exclusions].sort((a, b) => a.inventoryItemId - b.inventoryItemId).map(e => e.inventoryItemId).join(',')
  const mk = [...modifiers].sort((a, b) => a.modifierId - b.modifierId).map(m => m.modifierId).join(',')
  return `${productId}_x${xk}_e${ek}_m${mk}`
}

function lineUnitPrice(line: CartLine) {
  return line.product.salePrice
    + line.extras.reduce((s, e) => s + e.extraPrice, 0)
    + line.modifiers.reduce((s, m) => s + m.priceAdjustment, 0)
}

const PRODUCT_COLORS = [
  'bg-orange-400', 'bg-yellow-400', 'bg-green-500', 'bg-teal-500',
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-pink-500',
]

const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
} as const

const STATUS_LABELS = { PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada' }

export default function PosView() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const { data: carts = [] } = useQuery({ queryKey: ['carts'], queryFn: getCarts })
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe })
  const { data: mySales = [] } = useQuery({ queryKey: ['my-sales'], queryFn: getMySales })
  const { data: myRequests = [] } = useQuery({ queryKey: ['my-cancel-requests'], queryFn: getMyCancellationRequests })
  const { data: myShift, isLoading: shiftLoading } = useQuery({ queryKey: ['my-shift'], queryFn: getMyShift })
  const { data: attendance } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: getMyAttendance,
    enabled: !!myShift,
  })
  const { data: allRecipes = [] } = useQuery({ queryKey: ['recipes'], queryFn: getAllRecipes })
  const recipeMap = useMemo(() => new Map<number, Recipe>(allRecipes.map(r => [r.productId, r])), [allRecipes])

  const assignedCartId = me?.cartId ?? null
  const [manualCart, setManualCart] = useState<number | null>(null)
  const selectedCart = assignedCartId ?? manualCart

  const { data: cartRequisitions = [] } = useQuery<RequisitionResponse[]>({
    queryKey: ['cart-requisitions', selectedCart],
    queryFn: () => getRequisitionsByCart(selectedCart!),
    enabled: !!selectedCart,
    refetchInterval: 30_000,
  })

  const activeRequisition = cartRequisitions.find(r =>
    r.status === 'SOLICITADA' || r.status === 'APROBADA' || r.status === 'EN_TRANSITO'
  ) ?? null

  // Shift open form
  const [startingCash, setStartingCash] = useState('')
  const [declaredCash, setDeclaredCash] = useState('')
  const [shiftError, setShiftError] = useState('')
  const [showCloseShift, setShowCloseShift] = useState(false)

  const [cart, setCart] = useState<CartLine[]>([])
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showMySales, setShowMySales] = useState(false)
  const [paid, setPaid] = useState('')

  // Customization modal
  const [customProduct, setCustomProduct] = useState<Product | null>(null)
  const [customRecipe, setCustomRecipe] = useState<Recipe | null>(null)
  const [selExtras, setSelExtras] = useState<Set<number>>(new Set())          // recipeExtraId
  const [selExclusions, setSelExclusions] = useState<Set<number>>(new Set())  // inventoryItemId
  const [selModifiers, setSelModifiers] = useState<Map<number, number>>(new Map()) // groupId → modifierId
  const [modifierError, setModifierError] = useState('')

  // Fetch modifier groups when customization modal is open
  const { data: modifierGroups = [] } = useQuery<ProductModifierGroup[]>({
    queryKey: ['modifier-groups', customProduct?.id],
    queryFn: () => getModifierGroups(customProduct!.id),
    enabled: !!customProduct,
  })

  // Cancel request modal
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')

  // WhatsApp ticket modal
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [lastSaleId, setLastSaleId] = useState<number | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [ticketError, setTicketError] = useState('')
  // Auto-dismiss confirmation after sending ticket
  const [ticketConfirmation, setTicketConfirmation] = useState<SendTicketResponse | null>(null)

  // Blind receipt (resurtido)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receivedQtys, setReceivedQtys] = useState<Record<number, string>>({})
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptError, setReceiptError] = useState('')
  const [receiptDone, setReceiptDone] = useState(false)

  const addLineToCart = (product: Product, extras: SelectedExtraLine[], exclusions: ExclusionLine[], modifiers: SelectedModifierLine[]) => {
    const key = computeLineKey(product.id, extras, exclusions, modifiers)
    setCart((prev) => {
      const existing = prev.find((l) => l.lineKey === key)
      if (existing) return prev.map((l) => l.lineKey === key ? { ...l, quantity: l.quantity + 1 } : l)
      return [...prev, { product, quantity: 1, extras, exclusions, modifiers, lineKey: key }]
    })
    setError('')
  }

  const addToCart = (product: Product) => {
    const recipe = recipeMap.get(product.id)
    if (recipe && (recipe.items.length > 0 || recipe.extras.length > 0)) {
      setCustomProduct(product)
      setCustomRecipe(recipe)
      setSelExtras(new Set())
      setSelExclusions(new Set())
      setSelModifiers(new Map())
      setModifierError('')
    } else {
      addLineToCart(product, [], [], [])
    }
  }

  const confirmCustomization = () => {
    if (!customProduct) return

    // Validar grupos requeridos
    for (const group of modifierGroups) {
      if (group.required && !selModifiers.has(group.id)) {
        setModifierError(`Selecciona una opción de "${group.name}"`)
        return
      }
    }

    const extras: SelectedExtraLine[] = customRecipe
      ? customRecipe.extras
          .filter(e => selExtras.has(e.id))
          .map(e => ({ recipeExtraId: e.id, name: e.name, extraPrice: e.extraPrice, inventoryItemId: e.inventoryItemId, quantityRequired: e.quantityRequired }))
      : []
    const exclusions: ExclusionLine[] = customRecipe
      ? customRecipe.items
          .filter(i => selExclusions.has(i.inventoryItemId))
          .map(i => ({ inventoryItemId: i.inventoryItemId, name: i.inventoryItemName }))
      : []

    const modifiers: SelectedModifierLine[] = []
    for (const group of modifierGroups) {
      const selectedId = selModifiers.get(group.id)
      if (selectedId) {
        const mod = group.modifiers.find(m => m.id === selectedId)
        if (mod) {
          modifiers.push({
            modifierId: mod.id,
            groupId: group.id,
            modifierGroupName: group.name,
            modifierName: mod.name,
            priceAdjustment: mod.priceAdjustment,
          })
        }
      }
    }

    addLineToCart(customProduct, extras, exclusions, modifiers)
    setCustomProduct(null)
    setCustomRecipe(null)
    setModifierError('')
  }

  const updateQty = (lineKey: string, delta: number) => {
    setCart((prev) =>
      prev.map((l) => l.lineKey === lineKey ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)
    )
  }

  const removeLine = (lineKey: string) => setCart((prev) => prev.filter((l) => l.lineKey !== lineKey))

  const total = cart.reduce((sum, l) => sum + lineUnitPrice(l) * l.quantity, 0)

  const saleMut = useMutation({
    mutationFn: () => registerSale({
      cartId: selectedCart!,
      items: cart.map((l): SaleItemRequest => ({
        productId: l.product.id,
        quantity: l.quantity,
        extraIds: l.extras.map(e => e.recipeExtraId),
        exclusionInventoryItemIds: l.exclusions.map(e => e.inventoryItemId),
        selectedModifierIds: l.modifiers.map(m => m.modifierId),
      })),
    }),
    onSuccess: (sale) => {
      setCart([])
      setPaid('')
      setLastSaleId(sale.id)
      setCustomerName('')
      setCustomerPhone('')
      setTicketError('')
      setShowTicketModal(true)
      qc.invalidateQueries({ queryKey: ['my-sales'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Error al registrar la venta')
    },
  })

  const sendTicketMut = useMutation({
    mutationFn: () => sendTicket(lastSaleId!, { customerName: customerName.trim(), customerPhone: customerPhone.trim() }),
    onSuccess: (result) => {
      setShowTicketModal(false)
      setTicketConfirmation(result)
      setTimeout(() => setTicketConfirmation(null), 5000)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setTicketError(msg || 'Error al enviar el ticket')
    },
  })

  const skipTicket = () => {
    setShowTicketModal(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
  }

  const openShiftMut = useMutation({
    mutationFn: () => openShift({ cartId: selectedCart!, startingCash: Number(startingCash) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-shift'] })
      setStartingCash(''); setShiftError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setShiftError(msg || 'Error al abrir turno')
    },
  })

  const closeShiftMut = useMutation({
    mutationFn: () => closeShift({ declaredCash: Number(declaredCash) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-shift'] })
      setDeclaredCash(''); setShowCloseShift(false); setShiftError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setShiftError(msg || 'Error al cerrar turno')
    },
  })

  const cancelReqMut = useMutation({
    mutationFn: () => requestCancellation({ saleId: cancelTarget!.id, reason: cancelReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-cancel-requests'] })
      setCancelTarget(null); setCancelReason(''); setCancelError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setCancelError(msg || 'Error al enviar la solicitud')
    },
  })

  const openCancelModal = (sale: Sale) => {
    setCancelReason(''); setCancelError(''); setCancelTarget(sale)
  }

  const openReceiptModal = () => {
    if (!activeRequisition || activeRequisition.status !== 'EN_TRANSITO') return
    const init: Record<number, string> = {}
    activeRequisition.items.forEach((item) => { init[item.id] = '' })
    setReceivedQtys(init)
    setReceiptNotes('')
    setReceiptError('')
    setReceiptDone(false)
    setShowReceiptModal(true)
  }

  const receiveMut = useMutation({
    mutationFn: () => {
      const quantities: Record<number, number> = {}
      for (const [id, val] of Object.entries(receivedQtys)) {
        quantities[Number(id)] = Number(val) || 0
      }
      return receiveRequisition(activeRequisition!.id, {
        receivedQuantities: quantities,
        receiptNotes: receiptNotes.trim() || undefined,
      })
    },
    onSuccess: () => {
      setReceiptDone(true)
      qc.invalidateQueries({ queryKey: ['cart-requisitions', selectedCart] })
      setTimeout(() => setShowReceiptModal(false), 2000)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setReceiptError(msg || 'Error al registrar la recepción')
    },
  })

  const submitCancelRequest = () => {
    if (!cancelReason.trim()) { setCancelError('El motivo es obligatorio'); return }
    cancelReqMut.mutate()
  }

  const handleLogout = () => { logout(); navigate('/login') }

  // Request status for a sale
  const requestForSale = (saleId: number) => myRequests.find((r) => r.saleId === saleId)

  // ── Pantalla: turno aprobado / cerrado ─────────────────────────────────────
  if (!shiftLoading && myShift?.status === 'APPROVED') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <CheckCircle size={48} className="text-green-400" />
        <h1 className="text-white text-2xl font-bold">Turno cerrado y aprobado</h1>
        <p className="text-slate-400 text-sm max-w-xs">
          Tu turno del día fue aprobado por el administrador. Para seguir trabajando, abre un nuevo turno mañana.
        </p>
        <button onClick={handleLogout} className="mt-4 flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm">
          <LogOut size={16} /> Salir
        </button>
      </div>
    )
  }

  // ── Pantalla: turno en espera de aprobación ─────────────────────────────────
  if (!shiftLoading && myShift?.status === 'PENDING_APPROVAL') {
    const fmt = (n?: number | null) => n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
    const diff = myShift.difference ?? 0
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <Lock size={48} className="text-amber-400" />
        <h1 className="text-white text-2xl font-bold">Turno enviado para aprobación</h1>
        <p className="text-slate-400 text-sm">Espera a que el administrador revise y apruebe el cierre.</p>
        <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-xs text-left space-y-2 mt-2">
          <Row label="Fondo inicial" value={fmt(myShift.startingCash)} />
          <Row label={`Ventas (${myShift.saleCount})`} value={fmt(myShift.totalSales)} color="text-green-400" />
          <Row label="Esperado" value={fmt(myShift.expectedCash)} color="text-blue-400" />
          <Row label="Entregado" value={fmt(myShift.declaredCash)} />
          {diff !== 0 && (
            <Row
              label={diff > 0 ? 'Sobrante' : 'Faltante'}
              value={`${diff > 0 ? '+' : ''}${fmt(diff)}`}
              color={diff > 0 ? 'text-amber-400' : 'text-red-400'}
            />
          )}
          {diff === 0 && <p className="text-xs text-green-400 text-center pt-1">✓ Cuadra exacto</p>}
          {myShift.adminNotes && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mt-2">
              <p className="text-xs text-amber-400 font-medium">Nota del admin:</p>
              <p className="text-xs text-amber-300">{myShift.adminNotes}</p>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="mt-2 flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm">
          <LogOut size={16} /> Salir
        </button>
      </div>
    )
  }

  // ── Pantalla: selección de carrito ──────────────────────────────────────────
  if (!selectedCart) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 gap-4">
        <h1 className="text-white text-2xl font-bold mb-2">¿En qué carrito estás?</h1>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {carts.map((c) => (
            <button
              key={c.id}
              onClick={() => setManualCart(c.id)}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-6 rounded-2xl text-lg transition-all active:scale-95"
            >
              {c.name}
            </button>
          ))}
          {carts.length === 0 && (
            <p className="col-span-2 text-slate-400 text-sm text-center">
              No hay carritos configurados. Pide al administrador que cree uno.
            </p>
          )}
        </div>
        <button onClick={handleLogout} className="mt-4 flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm">
          <LogOut size={16} /> Salir
        </button>
      </div>
    )
  }

  const cartName = carts.find((c) => c.id === selectedCart)?.name ?? me?.cartName ?? ''

  // ── Pantalla: apertura de turno ─────────────────────────────────────────────
  if (!shiftLoading && !myShift) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 gap-4">
        <DollarSign size={40} className="text-violet-400" />
        <h1 className="text-white text-2xl font-bold">Apertura de turno</h1>
        <p className="text-slate-400 text-sm text-center max-w-xs">
          Indica el fondo de cambio con el que inicias el día en <span className="text-white font-medium">{cartName}</span>.
        </p>
        <div className="w-full max-w-xs space-y-3">
          <div>
            <label className="text-slate-400 text-xs block mb-1">Fondo de cambio inicial $</label>
            <input
              type="number"
              min={0}
              step="50"
              value={startingCash}
              onChange={(e) => { setStartingCash(e.target.value); setShiftError('') }}
              placeholder="1000.00"
              className="w-full bg-slate-800 text-white text-2xl text-center rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          {shiftError && <p className="text-red-400 text-xs text-center">{shiftError}</p>}
          <button
            onClick={() => openShiftMut.mutate()}
            disabled={!startingCash || Number(startingCash) < 0 || openShiftMut.isPending}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-lg py-4 rounded-2xl transition-all active:scale-95"
          >
            {openShiftMut.isPending ? 'Abriendo turno...' : 'ABRIR TURNO'}
          </button>
          <button onClick={() => setManualCart(null)} className="w-full text-slate-600 hover:text-slate-400 text-xs text-center py-1">
            Cambiar carrito
          </button>
        </div>
        <button onClick={handleLogout} className="mt-2 flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm">
          <LogOut size={16} /> Salir
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">

      {/* Product grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <Warehouse size={15} className="text-violet-400" />
              <h1 className="text-white font-bold text-lg">{cartName}</h1>
              {assignedCartId && (
                <span className="text-xs text-violet-400 font-medium bg-violet-400/10 px-1.5 py-0.5 rounded-full">asignado</span>
              )}
            </div>
            <p className="text-slate-400 text-xs">
              Turno abierto · Fondo: ${myShift?.startingCash?.toFixed(2) ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setDeclaredCash(''); setShiftError(''); setShowCloseShift(true) }}
              className="text-xs text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:border-amber-400/60 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              Cerrar turno
            </button>
            <button onClick={handleLogout} className="text-slate-500 hover:text-slate-300">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {products.map((product, i) => {
            const color = PRODUCT_COLORS[i % PRODUCT_COLORS.length]
            const inCart = cart.find((l) => l.product.id === product.id)
            return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className={`${color} relative rounded-2xl p-4 text-white text-left active:scale-95 transition-transform shadow-lg`}
              >
                {inCart && (
                  <span className="absolute top-2 right-2 bg-white/30 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {inCart.quantity}
                  </span>
                )}
                <p className="font-bold text-base leading-tight mt-4">{product.name}</p>
                <p className="text-white/80 text-sm mt-1">${product.salePrice.toFixed(2)}</p>
              </button>
            )
          })}
          {products.length === 0 && (
            <p className="col-span-full text-slate-500 text-sm text-center py-12">
              No hay productos configurados.
            </p>
          )}
        </div>
      </div>

      {/* Order summary + my sales */}
      <div className="md:w-80 bg-slate-900 flex flex-col border-t md:border-t-0 md:border-l border-slate-800">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <ShoppingCart size={18} className="text-violet-400" />
          <span className="text-white font-semibold text-sm">Orden actual</span>
        </div>

        {/* Widget de asistencia del periodo */}
        {attendance && (
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-800/50">
            <p className="text-slate-400 text-xs mb-1">{attendance.periodLabel}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {Array.from({ length: attendance.expectedWorkingDays }).map((_, i) => (
                    <div key={i}
                      className={`w-2.5 h-2.5 rounded-sm ${
                        i < attendance.shiftWorkedDays ? 'bg-green-500' : 'bg-slate-600'
                      }`} />
                  ))}
                </div>
              </div>
              <span className={`text-xs font-semibold ${
                attendance.shiftWorkedDays >= attendance.expectedWorkingDays ? 'text-green-400' : 'text-slate-300'
              }`}>
                {attendance.shiftWorkedDays}/{attendance.expectedWorkingDays} días
              </span>
            </div>
            {attendance.projectedPayroll != null && (
              <p className="text-xs text-slate-500 mt-1">
                Nómina proyectada: <span className="text-slate-300 font-medium">
                  {attendance.projectedPayroll.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {cart.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">Toca un producto para agregarlo</p>
          ) : (
            cart.map((line) => (
              <div key={line.lineKey} className="bg-slate-800 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{line.product.name}</p>
                    <p className="text-slate-400 text-xs">${lineUnitPrice(line).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(line.lineKey, -1)}
                      className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center">
                      <Minus size={11} />
                    </button>
                    <span className="text-white font-bold text-sm w-5 text-center">{line.quantity}</span>
                    <button onClick={() => updateQty(line.lineKey, 1)}
                      className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center">
                      <Plus size={11} />
                    </button>
                  </div>
                  <button onClick={() => removeLine(line.lineKey)} className="text-slate-600 hover:text-red-400 ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
                {line.extras.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {line.extras.map(e => (
                      <span key={e.recipeExtraId} className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
                        +{e.name} +${e.extraPrice.toFixed(2)}
                      </span>
                    ))}
                  </div>
                )}
                {line.modifiers.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {line.modifiers.map(m => (
                      <span key={m.modifierId} className="text-xs bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full">
                        {m.modifierGroupName}: {m.modifierName}
                        {m.priceAdjustment > 0 && ` +$${m.priceAdjustment.toFixed(2)}`}
                      </span>
                    ))}
                  </div>
                )}
                {line.exclusions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {line.exclusions.map(e => (
                      <span key={e.inventoryItemId} className="text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">
                        ✗ sin {e.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Total + change calculator + register */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Total</span>
            <span className="text-white text-2xl font-bold">${total.toFixed(2)}</span>
          </div>

          {/* Calculadora de cambio */}
          {cart.length > 0 && (
            <div className="bg-slate-800 rounded-xl px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs flex-1">Paga con</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.50"
                    value={paid}
                    onChange={(e) => setPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-24 bg-slate-700 text-white text-right rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>
              {paid !== '' && Number(paid) > 0 && (
                <div className="flex items-center justify-between border-t border-slate-700 pt-2">
                  <span className="text-slate-400 text-xs">Cambio</span>
                  <span className={`font-bold text-lg ${Number(paid) >= total ? 'text-green-400' : 'text-red-400'}`}>
                    {Number(paid) >= total
                      ? `$${(Number(paid) - total).toFixed(2)}`
                      : `-$${(total - Number(paid)).toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => saleMut.mutate()}
            disabled={cart.length === 0 || saleMut.isPending || success}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 ${
              success
                ? 'bg-green-500 text-white'
                : cart.length === 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg'
            }`}
          >
            {success ? (
              <span className="flex items-center justify-center gap-2"><CheckCircle size={20} /> ¡Venta registrada!</span>
            ) : saleMut.isPending ? 'Registrando...' : 'REGISTRAR VENTA'}
          </button>
          {!assignedCartId && (
            <button onClick={() => setManualCart(null)}
              className="w-full text-slate-600 hover:text-slate-400 text-xs text-center py-1">
              Cambiar carrito
            </button>
          )}
        </div>

        {/* ── Mis ventas del día ───────────────────────────────────────────────── */}
        <div className="border-t border-slate-800">
          <button
            onClick={() => setShowMySales((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:text-slate-200 text-xs font-semibold uppercase tracking-wide transition-colors"
          >
            <span className="flex items-center gap-2">
              <XCircle size={14} /> Mis ventas de hoy ({mySales.length})
            </span>
            {showMySales ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showMySales && (
            <div className="px-3 pb-4 space-y-2 max-h-64 overflow-y-auto">
              {mySales.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-4">Sin ventas registradas hoy.</p>
              ) : (
                mySales.map((sale) => {
                  const req = requestForSale(sale.id)
                  const canRequest = sale.status === 'COMPLETED' && !req
                  return (
                    <div key={sale.id} className="bg-slate-800 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-300 text-xs font-medium">
                          #{sale.id} · ${sale.totalAmount.toFixed(2)}
                        </span>
                        {sale.status === 'CANCELLED' && (
                          <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">Cancelada</span>
                        )}
                        {req && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[req.status]}`}>
                            {STATUS_LABELS[req.status]}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs">{new Date(sale.soldAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                      {canRequest && (
                        <button
                          onClick={() => openCancelModal(sale)}
                          className="mt-1.5 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                        >
                          <Clock size={11} /> Solicitar cancelación
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* ── Resurtido / requisición activa ───────────────────────────────────── */}
        {activeRequisition && (
          <div className="border-t border-slate-800">
            {activeRequisition.status === 'EN_TRANSITO' ? (
              <div className="px-4 py-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 text-xs font-semibold uppercase tracking-wide">
                      Mercancía en camino
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Hay un resurtido en tránsito para este carrito. Cuando recibas la mercancía,
                    haz el conteo y regístralo.
                  </p>
                  {activeRequisition.dispatchNotes && (
                    <p className="text-xs text-emerald-200/70 italic">"{activeRequisition.dispatchNotes}"</p>
                  )}
                  <button
                    onClick={openReceiptModal}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ClipboardCheck size={13} />
                    Registrar recepción (conteo ciego)
                  </button>
                </div>
              </div>
            ) : activeRequisition.status === 'APROBADA' ? (
              <div className="px-4 py-3">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2">
                  <PackageCheck size={14} className="text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-300 text-xs font-semibold">Resurtido aprobado</p>
                    <p className="text-slate-500 text-xs mt-0.5">En espera de despacho por el administrador.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                  <Clock size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 text-xs font-semibold">Requisición pendiente</p>
                    <p className="text-slate-500 text-xs mt-0.5">Esperando aprobación del administrador.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal personalización de producto ───────────────────────────────── */}
      {customProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h3 className="font-bold text-slate-800">{customProduct.name}</h3>
                <p className="text-xs text-slate-400">Personaliza este producto</p>
              </div>
              <button onClick={() => { setCustomProduct(null); setCustomRecipe(null); setModifierError('') }}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-2 space-y-4">
              {/* Ingredientes base */}
              {customRecipe && customRecipe.items.length > 0 && (() => {
                const excludable = customRecipe.items.filter(i => i.canExclude)
                const fixed      = customRecipe.items.filter(i => !i.canExclude)
                return (
                  <div className="space-y-3">
                    {excludable.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                          Ingredientes <span className="font-normal normal-case text-slate-400">(toca para quitar)</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {excludable.map((item) => {
                            const excluded = selExclusions.has(item.inventoryItemId)
                            return (
                              <button
                                key={item.inventoryItemId}
                                onClick={() => setSelExclusions(prev => {
                                  const next = new Set(prev)
                                  excluded ? next.delete(item.inventoryItemId) : next.add(item.inventoryItemId)
                                  return next
                                })}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                  excluded
                                    ? 'bg-red-50 border-red-200 text-red-500 line-through'
                                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {excluded && <X size={11} />}
                                {item.inventoryItemName}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {fixed.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Siempre incluido</p>
                        <div className="flex flex-wrap gap-2">
                          {fixed.map((item) => (
                            <span
                              key={item.inventoryItemId}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border bg-slate-50 border-slate-200 text-slate-400 cursor-default"
                            >
                              <Lock size={10} />
                              {item.inventoryItemName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Extras opcionales */}
              {customRecipe && customRecipe.extras.filter(e => e.active).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={13} className="text-amber-500" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Extras opcionales</p>
                  </div>
                  <div className="space-y-1.5">
                    {customRecipe.extras.filter(e => e.active).map((extra: RecipeExtra) => {
                      const selected = selExtras.has(extra.id)
                      return (
                        <button
                          key={extra.id}
                          onClick={() => setSelExtras(prev => {
                            const next = new Set(prev)
                            selected ? next.delete(extra.id) : next.add(extra.id)
                            return next
                          })}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-all ${
                            selected
                              ? 'bg-amber-50 border-amber-300 text-slate-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selected ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                            }`}>
                              {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                            <span className="font-medium">{extra.name}</span>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            selected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            +${extra.extraPrice.toFixed(2)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Grupos de modificadores */}
              {modifierGroups.filter(g => g.active).map(group => (
                <div key={group.id}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{group.name}</p>
                    {group.required && (
                      <span className="text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">requerido</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {group.modifiers.filter(m => m.active).map(modifier => {
                      const isSelected = selModifiers.get(group.id) === modifier.id
                      return (
                        <button
                          key={modifier.id}
                          onClick={() => {
                            setSelModifiers(prev => {
                              const next = new Map(prev)
                              isSelected ? next.delete(group.id) : next.set(group.id, modifier.id)
                              return next
                            })
                            setModifierError('')
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-all ${
                            isSelected
                              ? 'bg-violet-50 border-violet-400 text-slate-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                            <span className="font-medium">{modifier.name}</span>
                          </div>
                          {modifier.priceAdjustment > 0 && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isSelected ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              +${modifier.priceAdjustment.toFixed(2)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer con precio y botón */}
            <div className="px-5 py-4 border-t border-slate-100 mt-auto">
              {(() => {
                const extrasTotal = customRecipe
                  ? customRecipe.extras.filter(e => selExtras.has(e.id)).reduce((s, e) => s + e.extraPrice, 0)
                  : 0
                const modifiersTotal = Array.from(selModifiers.entries()).reduce((s, [gid, mid]) => {
                  const g = modifierGroups.find(g => g.id === gid)
                  const m = g?.modifiers.find(m => m.id === mid)
                  return s + (m?.priceAdjustment ?? 0)
                }, 0)
                const unitTotal = customProduct.salePrice + extrasTotal + modifiersTotal
                return (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-500">Precio unitario</span>
                    <div className="text-right">
                      <span className="text-white text-lg font-bold bg-slate-800 px-3 py-0.5 rounded-lg">
                        ${unitTotal.toFixed(2)}
                      </span>
                      {(extrasTotal > 0 || modifiersTotal > 0) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          ${customProduct.salePrice.toFixed(2)}
                          {extrasTotal > 0 && <span className="text-amber-500"> + ${extrasTotal.toFixed(2)} extras</span>}
                          {modifiersTotal > 0 && <span className="text-violet-500"> + ${modifiersTotal.toFixed(2)} variante</span>}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}
              {modifierError && (
                <p className="text-xs text-red-500 mb-2">{modifierError}</p>
              )}
              <button
                onClick={confirmCustomization}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all"
              >
                Agregar al pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ticket de WhatsApp ─────────────────────────────────────────── */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-green-500" />
                <h3 className="font-bold text-slate-800">Enviar ticket por WhatsApp</h3>
              </div>
              <button onClick={skipTicket}><X size={20} className="text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Ingresa los datos del cliente para enviarle su comprobante. Puedes omitirlo si el cliente no desea darlo.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Nombre del cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => { setCustomerName(e.target.value); setTicketError('') }}
                  placeholder="Ej: Juan Pérez"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Número de WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => { setCustomerPhone(e.target.value); setTicketError('') }}
                  placeholder="Ej: 5215512345678"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              {ticketError && <p className="text-xs text-red-500">{ticketError}</p>}
            </div>

            <p className="text-xs text-slate-400 mb-4 flex items-start gap-1">
              <span className="text-green-500 font-bold">✦</span>
              Los datos se guardan para futuras campañas de marketing.
            </p>

            <div className="flex gap-3">
              <button
                onClick={skipTicket}
                className="flex-1 border border-slate-300 text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50"
              >
                Omitir
              </button>
              <button
                onClick={() => sendTicketMut.mutate()}
                disabled={!customerName.trim() || !customerPhone.trim() || sendTicketMut.isPending}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={14} />
                {sendTicketMut.isPending ? 'Enviando...' : 'Enviar ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación auto-dismiss: ticket enviado ─────────────────────────── */}
      {ticketConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setTicketConfirmation(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <CheckCircle size={26} className="text-green-500" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">¡Ticket enviado!</h3>
              <p className="text-sm text-slate-500 mt-1">
                Mensaje enviado al WhatsApp:{' '}
                <span className="font-semibold text-slate-700">{ticketConfirmation.customerPhone}</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Cliente: <span className="font-medium">{ticketConfirmation.customerName}</span>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-400 font-medium mb-1.5">Vista previa del ticket:</p>
              <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap leading-tight max-h-48 overflow-y-auto">
                {ticketConfirmation.ticketText}
              </pre>
            </div>

            <button
              onClick={() => setTicketConfirmation(null)}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-xl"
            >
              Cerrar
            </button>
            <p className="text-xs text-slate-400 text-center mt-2">Se cierra automáticamente en unos segundos</p>
          </div>
        </div>
      )}

      {/* ── Modal cierre de turno ────────────────────────────────────────────── */}
      {showCloseShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-amber-500" />
                <h3 className="font-bold text-slate-800">Cerrar turno</h3>
              </div>
              <button onClick={() => setShowCloseShift(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4 text-sm">
              <p className="text-xs text-slate-500 font-medium mb-1.5">Resumen del turno</p>
              <div className="flex justify-between text-slate-700">
                <span>Fondo inicial</span>
                <span className="font-medium">${myShift?.startingCash?.toFixed(2) ?? '—'}</span>
              </div>
              <div className="flex justify-between text-slate-700 mt-1">
                <span>Ventas completadas</span>
                <span className="font-medium">{mySales.filter(s => s.status === 'COMPLETED').length}</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Total en caja al cerrar $ <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.50"
                value={declaredCash}
                onChange={(e) => { setDeclaredCash(e.target.value); setShiftError('') }}
                placeholder="0.00"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              />
              <p className="text-xs text-slate-400 mt-1">Fondo de cambio + dinero de las ventas del día.</p>
              {shiftError && <p className="text-xs text-red-500 mt-1">{shiftError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseShift(false)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => closeShiftMut.mutate()}
                disabled={!declaredCash || closeShiftMut.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg"
              >
                {closeShiftMut.isPending ? 'Cerrando...' : 'Enviar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal recepción ciega de resurtido ───────────────────────────────── */}
      {showReceiptModal && activeRequisition?.status === 'EN_TRANSITO' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-800">Conteo de recepción</h3>
                  <p className="text-xs text-slate-400">Cuenta físicamente cada ítem e ingresa lo que recibiste</p>
                </div>
              </div>
              <button onClick={() => setShowReceiptModal(false)}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {receiptDone ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <CheckCircle size={40} className="text-emerald-500" />
                <p className="font-semibold text-slate-700">¡Recepción registrada!</p>
                <p className="text-xs text-slate-400 text-center px-6">
                  El sistema comparará lo que recibiste con lo que fue despachado.
                </p>
              </div>
            ) : (
              <>
                {/* Nota del despachador */}
                {activeRequisition.dispatchNotes && (
                  <div className="mx-5 mt-4 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-600 font-medium">Nota del despachador:</p>
                    <p className="text-sm text-blue-800 mt-0.5">{activeRequisition.dispatchNotes}</p>
                  </div>
                )}

                {/* Lista de ítems — solo nombre y unidad, el vendedor captura cantidad */}
                <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
                  {activeRequisition.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.inventoryItemName}</p>
                        <p className="text-xs text-slate-400 uppercase">{item.unitType}</p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="0"
                        value={receivedQtys[item.id] ?? ''}
                        onChange={(e) => {
                          setReceivedQtys((prev) => ({ ...prev, [item.id]: e.target.value }))
                          setReceiptError('')
                        }}
                        className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  ))}
                </div>

                {/* Notas opcionales */}
                <div className="px-5 pb-3">
                  <textarea
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    rows={2}
                    placeholder="Notas opcionales (faltante, daños, observaciones...)"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500 resize-none placeholder:text-slate-400"
                  />
                  {receiptError && <p className="text-xs text-red-500 mt-1">{receiptError}</p>}
                </div>

                {/* Acciones */}
                <div className="px-5 pb-5 flex gap-3">
                  <button
                    onClick={() => setShowReceiptModal(false)}
                    className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => receiveMut.mutate()}
                    disabled={receiveMut.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg"
                  >
                    {receiveMut.isPending ? 'Registrando...' : 'Confirmar recepción'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal solicitar cancelación ──────────────────────────────────────── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-red-500" />
                <h3 className="font-bold text-slate-800">Solicitar cancelación</h3>
              </div>
              <button onClick={() => setCancelTarget(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Venta <span className="font-medium text-slate-800">#{cancelTarget.id}</span> por{' '}
              <span className="font-medium text-slate-800">${cancelTarget.totalAmount.toFixed(2)}</span>.
              Tu solicitud será enviada al administrador para su aprobación.
            </p>
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Motivo de cancelación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => { setCancelReason(e.target.value); setCancelError('') }}
                rows={3}
                placeholder="Describe con detalle el motivo..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
              />
              {cancelError && <p className="text-xs text-red-500 mt-1">{cancelError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCancelTarget(null)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={submitCancelRequest}
                disabled={cancelReqMut.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg"
              >
                {cancelReqMut.isPending ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}
