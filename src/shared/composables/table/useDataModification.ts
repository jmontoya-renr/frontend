import { ref } from 'vue'
import axios from '@/plugins/axios'

import type { AxiosInstance } from 'axios'
import type { WithId } from '@/shared/types/with-id'

export function useDataModification<T extends WithId>(
  apiUrl: string,
  axiosInstance: AxiosInstance = axios,
) {
  const isSaving = ref(false)
  const error = ref<unknown | null>(null)

  // Normaliza la comparación: "123" === 123
  const sameId = (a: string | number, b: string | number) => String(a) === String(b)

  // Optimistic update
  const updateItemOptimistic = (
    items: Array<T>,
    id: string | number,
    patch: Partial<T>,
  ): Array<T> => {
    return items.map((item) => (sameId(item.id, id) ? ({ ...item, ...patch } as T) : item))
  }

  // Agregar optimista
  const addItemOptimistic = (items: Array<T>, newItem: T): Array<T> => {
    return [newItem, ...items]
  }

  // Guardar cambios
  const saveChanges = async (
    items: Array<T>,
    patch: Partial<T>,
    id: string | number,
  ): Promise<Array<T>> => {
    isSaving.value = true
    error.value = null
    try {
      // await axiosInstance.patch(`${apiUrl}/${id}`, patch) // acepta "123" o 123
      return updateItemOptimistic(items, id, patch)
    } catch (err) {
      console.error('Error saving data:', err)
      error.value = err
      throw err
    } finally {
      isSaving.value = false
    }
  }

  // Crear nuevo
  const addItem = async (items: Array<T>, newItem: T): Promise<Array<T>> => {
    isSaving.value = true
    error.value = null
    try {
      const { data: createdItem } = await axiosInstance.post<T>(apiUrl, newItem)
      return addItemOptimistic(items, createdItem)
    } catch (err) {
      console.error('Error adding data:', err)
      error.value = err
      throw err
    } finally {
      isSaving.value = false
    }
  }

  return { isSaving, error, saveChanges, addItem }
}
