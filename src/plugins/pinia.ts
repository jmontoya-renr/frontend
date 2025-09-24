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
      localStorage.setItem(store.$id, JSON.stringify({ ...state }))
    },
    { deep: true },
  )
})

export default pinia
