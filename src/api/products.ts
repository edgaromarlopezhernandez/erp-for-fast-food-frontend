import client from './client'
import type { Category, CategoryRequest, Product, ProductRequest } from '../types'

// Categories
export const getCategories = () =>
  client.get<Category[]>('/api/categories').then((r) => r.data)
export const createCategory = (data: CategoryRequest) =>
  client.post<Category>('/api/categories', data).then((r) => r.data)
export const updateCategory = (id: number, data: CategoryRequest) =>
  client.put<Category>(`/api/categories/${id}`, data).then((r) => r.data)
export const deleteCategory = (id: number) =>
  client.delete(`/api/categories/${id}`)

// Products
export const getProducts = () =>
  client.get<Product[]>('/api/products').then((r) => r.data)
export const getProduct = (id: number) =>
  client.get<Product>(`/api/products/${id}`).then((r) => r.data)
export const createProduct = (data: ProductRequest) =>
  client.post<Product>('/api/products', data).then((r) => r.data)
export const updateProduct = (id: number, data: ProductRequest) =>
  client.put<Product>(`/api/products/${id}`, data).then((r) => r.data)
export const deleteProduct = (id: number) =>
  client.delete(`/api/products/${id}`)
