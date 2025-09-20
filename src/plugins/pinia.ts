import { watch } from 'vue'
import { createPinia } from 'pinia'

const pinia = createPinia()

pinia.use(({ store }) => {
  const storedState = localStorage.getItem(store.$id)
  if (storedState) {
    store.$patch(JSON.parse(storedState))
  }

  watch(
    store.$state,
    (state) => {
      /* Si se quieren excluir los tokens!!!
      // Filtrar tokens del auth store
      const stateToSave = { ...state }

      if (store.$id === 'auth') {
        // Elimina propiedades sensibles
        delete stateToSave.accessToken
        delete stateToSave.refreshToken
      }

      localStorage.setItem(store.$id, JSON.stringify(stateToSave))
      */

      localStorage.setItem(store.$id, JSON.stringify({ ...state }))
    },
    { deep: true },
  )
})

export default pinia
