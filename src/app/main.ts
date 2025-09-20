import '@/shared/styles/sonner.css'
import '@/shared/styles/global.css'
import '@/shared/styles/variables.css'

import { createApp } from 'vue'

import App from '@/app/App.vue'
import router from '@/router'
import { i18n, pinia } from '@/plugins'
import { useAuthStore } from '@/features/auth/stores'

const app = createApp(App)

app.use(pinia)
app.use(i18n)

await useAuthStore().restoreSession()

app.use(router)

app.mount('#app')
