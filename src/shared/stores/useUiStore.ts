import { i18n } from '@/plugins'
import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { useColorMode } from '@vueuse/core'

export const useUiStore = defineStore('ui', () => {
  const lang: Ref<'es' | 'en' | 'cat'> = ref('es')
  const font: Ref<'inter' | 'manrope' | 'system'> = ref('inter')

  const mode = useColorMode({
    initialValue: 'light',
    storageKey: 'theme',
    attribute: 'class',
    emitAuto: true,
    disableTransition: false,
  })

  function changeTheme(theme: 'dark' | 'light' | 'auto') {
    mode.value = theme
  }

  function initLang() {
    // @ts-expect-error TS2551
    i18n.global.locale.value = lang.value
    document.documentElement.lang = lang.value
  }

  function setLang(newLang: 'es' | 'en' | 'cat') {
    lang.value = newLang
    // @ts-expect-error TS2551
    i18n.global.locale.value = newLang
    document.documentElement.lang = newLang
  }

  function setFont(newFont: 'inter' | 'manrope' | 'system') {
    font.value = newFont
  }

  return { mode, lang, font, changeTheme, initLang, setLang, setFont }
})
