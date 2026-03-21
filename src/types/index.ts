// ── Auth ──────────────────────────────────────────────────────────────────────
export interface LoginRequest { username: string; password: string }
export interface LoginResponse { token: string; role: UserRole; tenantId: number; businessName?: string | null }
export interface RegisterRequest {
  businessName: string; businessSlug: string; ownerWhatsapp: string
  name: string; username: string; password: string
}
export interface RegisterResponse {
  tenantId: number; businessName: string; adminUsername: string
  token: string; subscriptionStatus: string; trialEndsAt: string
}

// ── Users ─────────────────────────────────────────────────────────────────────
export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER'
export type PayrollPeriod = 'BIWEEKLY' | 'WEEKLY' | 'MONTHLY'

export interface UserResponse {
  id: number; name: string; username: string; role: UserRole; active: boolean
  cartId?: number; cartName?: string
  fullName?: string; phone?: string; position?: string; hireDate?: string
  emergencyContact?: string; emergencyPhone?: string
  bankAccount?: string; curp?: string; hrNotes?: string
  salary?: number; payrollPeriod?: PayrollPeriod; restDay?: string; payrollDueToday: boolean
  isOwner: boolean
}
export interface UserRequest {
  name: string; username: string; password?: string; role: UserRole
  cartId?: number
  fullName?: string; phone?: string; position?: string; hireDate?: string
  emergencyContact?: string; emergencyPhone?: string
  bankAccount?: string; curp?: string; hrNotes?: string
  salary?: number; payrollPeriod?: PayrollPeriod; restDay?: string
  isOwner?: boolean
}

// ── Categories ────────────────────────────────────────────────────────────────
export interface Category { id: number; name: string; active: boolean }
export interface CategoryRequest { name: string }

// ── Products ──────────────────────────────────────────────────────────────────
export interface Product {
  id: number; name: string; description?: string
  salePrice: number; categoryId?: number; categoryName?: string; active: boolean
}
export interface ProductRequest {
  name: string; description?: string; salePrice: number; categoryId?: number
}

// ── Inventory ─────────────────────────────────────────────────────────────────
export type UnitType = 'PIECE' | 'GRAM' | 'MILLILITER'
export type MovementType =
  | 'PURCHASE' | 'TRANSFER_TO_CART' | 'TRANSIT_DISPATCHED' | 'SALE_DEDUCTION'
  | 'MANUAL_ADJUSTMENT' | 'WASTE' | 'RETURN' | 'OPENING_STOCK'

export interface InventoryItem {
  id: number; name: string; unitType: UnitType
  currentStock: number   // stock de la ubicación solicitada (bodega o carrito)
  centralStock: number   // siempre el stock de bodega general
  minimumStock: number; averageCost: number
  belowMinimum: boolean; active: boolean
}
export interface InventoryItemRequest {
  name: string; unitType: UnitType; minimumStock: number; averageCost: number
}
export interface StockAdjustmentRequest {
  inventoryItemId: number; movementType: MovementType; quantity: number; unitCost?: number; notes?: string
}
export interface InventoryMovement {
  id: number; movementType: MovementType; quantity: number; unitCost?: number
  notes?: string; relatedEntityType?: string; relatedEntityId?: number; createdAt: string
}

// ── Payroll ───────────────────────────────────────────────────────────────────
export interface DuePayrollItem {
  employeeId: number
  employeeName: string
  username: string
  position?: string
  hireDate?: string
  salary: number
  amountDue: number
  prorated: boolean
  expectedWorkingDays: number
  shiftWorkedDays: number
  daysWorked: number
  totalDaysInPeriod: number
  payrollPeriod: PayrollPeriod
  periodLabel: string
}
export interface PayrollPaymentRequest {
  employeeId: number
  amount: number
  paidDate?: string
  periodLabel: string
  notes?: string
}
export interface PayrollPaymentResponse {
  id: number
  employeeId: number
  employeeName: string
  amount: number
  paidDate: string
  periodLabel: string
  notes?: string
}

// ── Reports ───────────────────────────────────────────────────────────────────
export interface PurchaseOrderSummary {
  id: number; folio: string; supplier?: string
  totalAmount: number; createdByName?: string; createdAt: string
}
export interface PayrollSummary {
  id: number; employeeName: string; amount: number; paidDate: string; periodLabel: string
}
export interface ExpenseSummary {
  id: number; date: string; amount: number
  description: string; category?: string; cartName?: string; createdByName?: string
}
export interface FinancialReport {
  year: number; month: number; monthLabel: string
  cartId?: number; cartName?: string
  reportScope: 'GENERAL' | 'CART'
  restockingIncluded: boolean
  totalSales: number; totalRestocking: number; totalPayroll: number
  totalOperationalExpenses: number
  totalExpenses: number; netProfit: number; profitMarginPct: number
  saleCount: number; purchaseOrderCount: number; payrollPaymentCount: number
  operationalExpenseCount: number
  purchaseOrders: PurchaseOrderSummary[]
  payrollPayments: PayrollSummary[]
  operationalExpenses: ExpenseSummary[]
}

// ── Purchase Orders (Resurtidos) ───────────────────────────────────────────────
export type PurchaseOrderStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'

export interface PurchaseOrderItemRequest {
  inventoryItemId: number
  quantity: number
  unitCost: number
}
export interface PurchaseOrderRequest {
  supplier?: string
  notes?: string
  items: PurchaseOrderItemRequest[]
}
export interface PurchaseOrderItemResponse {
  id: number
  inventoryItemId: number
  inventoryItemName: string
  unitType: string
  quantity: number
  unitCost: number
  totalCost: number
}
export interface PurchaseOrder {
  id: number
  folio: string
  supplier?: string
  notes?: string
  status: PurchaseOrderStatus
  totalAmount: number
  createdAt: string
  createdBy?: number
  createdByName?: string
  items: PurchaseOrderItemResponse[]
}

// ── Recipes ───────────────────────────────────────────────────────────────────
export interface RecipeItemRequest { inventoryItemId: number; quantityRequired: number; canExclude?: boolean }
export interface RecipeRequest { productId: number; items: RecipeItemRequest[] }
export interface RecipeItem {
  inventoryItemId: number; inventoryItemName: string; unitType: string; quantityRequired: number; canExclude: boolean
}
export interface RecipeExtra {
  id: number; name: string; extraPrice: number
  inventoryItemId: number; inventoryItemName: string; unitType: string
  quantityRequired: number; active: boolean
}
export interface RecipeExtraRequest {
  recipeId?: number; name: string; extraPrice: number
  inventoryItemId: number; quantityRequired: number; active?: boolean
}
export interface Recipe {
  id: number; productId: number; productName: string
  items: RecipeItem[]; extras: RecipeExtra[]; estimatedCost: number
}

// ── Carts ─────────────────────────────────────────────────────────────────────
export interface Cart { id: number; name: string; location?: string; active: boolean }
export interface CartRequest { name: string; location?: string }

// ── Attendance ────────────────────────────────────────────────────────────────
export interface ShiftDaySummary {
  shiftId: number
  date: string
  status: 'OPEN' | 'PENDING_APPROVAL' | 'APPROVED'
  totalSales?: number
  saleCount: number
}
export interface AttendanceSummary {
  employeeId: number
  employeeName: string
  position?: string
  payrollPeriod?: string
  restDay?: string
  periodLabel: string
  periodStart: string
  periodEnd: string
  expectedWorkingDays: number
  shiftWorkedDays: number
  missedDays: number
  attendancePct: number
  salary?: number
  projectedPayroll?: number
  shifts: ShiftDaySummary[]
}

// ── Shifts ────────────────────────────────────────────────────────────────────
export type ShiftStatus = 'OPEN' | 'PENDING_APPROVAL' | 'APPROVED'
export interface Shift {
  id: number
  cartId: number
  cartName: string
  sellerId: number
  sellerName: string
  status: ShiftStatus
  openedAt: string
  closedAt?: string
  startingCash: number
  declaredCash?: number
  expectedCash?: number
  totalSales?: number
  saleCount: number
  difference?: number
  adminNotes?: string
  reviewedAt?: string
}
export interface OpenShiftRequest { cartId: number; startingCash: number }
export interface CloseShiftRequest { declaredCash: number }
export interface ShiftReview { adminNotes?: string }

// ── Cancellation Requests ──────────────────────────────────────────────────────
export type CancellationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export interface CancellationRequestCreate { saleId: number; reason: string }
export interface CancellationRequestReview { adminNotes?: string }
export interface CancellationRequest {
  id: number
  saleId: number
  saleTotal: number
  cartName: string
  soldAt: string
  reason: string
  requestedBy: number
  requestedByName: string
  status: CancellationRequestStatus
  requestedAt: string
  reviewedAt?: string
  adminNotes?: string
}

// ── Sales ─────────────────────────────────────────────────────────────────────
export type SaleStatus = 'COMPLETED' | 'CANCELLED'
export interface SaleItemRequest {
  productId: number; quantity: number
  extraIds?: number[]
  exclusionInventoryItemIds?: number[]
}
export interface SaleRequest { cartId: number; items: SaleItemRequest[]; notes?: string }
export interface SaleItemDetail {
  productId: number; productName: string; quantity: number; unitPrice: number; subtotal: number
}
export interface Sale {
  id: number; cartId: number; cartName: string; sellerId: number
  soldAt: string; totalAmount: number; status: SaleStatus; notes?: string
  items: SaleItemDetail[]
  customerId?: number; customerName?: string; customerPhone?: string
}
export interface SendTicketRequest { customerName: string; customerPhone: string }
export interface SendTicketResponse {
  customerId: number; customerName: string; customerPhone: string
  ticketText: string; simulated: boolean
}
