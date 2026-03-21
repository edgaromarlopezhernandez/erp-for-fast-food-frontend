import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Categories from './pages/Categories'
import Inventory from './pages/Inventory'
import Recipes from './pages/Recipes'
import Carts from './pages/Carts'
import Users from './pages/Users'
import Sales from './pages/Sales'
import PosView from './pages/PosView'
import PurchaseOrders from './pages/PurchaseOrders'
import Reports from './pages/Reports'
import Expenses from './pages/Expenses'
import Requisitions from './pages/Requisitions'
import Payroll from './pages/Payroll'
import Cancellations from './pages/Cancellations'
import Shifts from './pages/Shifts'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login"
        element={user ? <Navigate to={user.role === 'CASHIER' ? '/pos' : '/dashboard'} replace /> : <Login />}
      />
      <Route path="/register" element={<Register />} />

      {/* POS — full screen, no sidebar */}
      <Route path="/pos" element={
        <ProtectedRoute>
          <PosView />
        </ProtectedRoute>
      } />

      {/* Admin / Manager — with sidebar layout */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/products" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><Products /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/categories" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><Categories /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><Inventory /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/recipes" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <Layout><Recipes /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/carts" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <Layout><Carts /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <Layout><Users /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/sales" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><Sales /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/purchase-orders" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><PurchaseOrders /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/expenses" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <Layout><Expenses /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/requisitions" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><Requisitions /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><Reports /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/payroll" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><Payroll /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/cancellations" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <Layout><Cancellations /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/shifts" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
          <Layout><Shifts /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/" element={
        user
          ? <Navigate to={user.role === 'CASHIER' ? '/pos' : '/dashboard'} replace />
          : <Navigate to="/login" replace />
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
