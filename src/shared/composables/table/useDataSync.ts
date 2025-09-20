import type { WithId } from '@/shared/types/with-id'

import { useCursorPagination } from '@/shared/composables/table/useCursorPagination'
import { useDataModification } from '@/shared/composables/table/useDataModification'

export function useDataSync<T extends WithId>(apiUrl: string, pageSize?: number) {
  const { status, allItems, loadMore, hasNextPage, isFetching, isFetchingNextPage, error } =
    useCursorPagination<T>(apiUrl, pageSize)
  const { isSaving, saveChanges, addItem } = useDataModification<T>(apiUrl)

  const updateAndSync = async (id: string, patch: Partial<T>): Promise<Array<T> | void> => {
    try {
      const updatedItems = await saveChanges(allItems.value, patch, id)
      return updatedItems
    } catch (err) {
      console.error('Error al sincronizar con el servidor:', err)
    }
  }

  const addNewItem = async (newItem: T): Promise<Array<T> | void> => {
    try {
      const updatedItems = await addItem(allItems.value, newItem)
      return updatedItems
    } catch (err) {
      console.error('Error al agregar el ítem:', err)
    }
  }

  return {
    status,
    allItems,
    loadMore,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    error,
    isSaving,
    updateAndSync,
    addNewItem,
  }
}
