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
      const stateToSave = { ...state }

      if (store.$id === 'auth') {
        delete stateToSave.accessToken
      }

      localStorage.setItem(store.$id, JSON.stringify(stateToSave))
    },
    { deep: true },
  )
})

export default pinia
