import client from './client'
import type { Recipe, RecipeRequest, RecipeExtraRequest } from '../types'

export const getAllRecipes = () =>
  client.get<Recipe[]>('/api/recipes').then((r) => r.data)
export const getRecipeByProduct = (productId: number) =>
  client.get<Recipe>(`/api/recipes/product/${productId}`).then((r) => r.data)
export const saveRecipe = (data: RecipeRequest) =>
  client.post<Recipe>('/api/recipes', data).then((r) => r.data)
export const deleteRecipe = (productId: number) =>
  client.delete(`/api/recipes/product/${productId}`)

// Extras
export const addRecipeExtra = (data: RecipeExtraRequest) =>
  client.post<Recipe>('/api/recipes/extras', data).then((r) => r.data)
export const updateRecipeExtra = (id: number, data: RecipeExtraRequest) =>
  client.put<Recipe>(`/api/recipes/extras/${id}`, data).then((r) => r.data)
export const deleteRecipeExtra = (id: number) =>
  client.delete(`/api/recipes/extras/${id}`)
