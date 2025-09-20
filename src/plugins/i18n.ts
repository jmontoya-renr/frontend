import { createI18n } from 'vue-i18n'

import es from '@/shared/i18n/es.json'
import en from '@/shared/i18n/en.json'
import cat from '@/shared/i18n/cat.json'

const messages = { es, en, cat } as const

export type MessageSchema = (typeof messages)['es']
export type Locales = keyof typeof messages

const i18n = createI18n<[MessageSchema], Locales>({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'es',
  messages,
})

type GlobalComposer = typeof i18n.global
export const t: GlobalComposer['t'] = i18n.global.t

export default i18n
