import { useUiStore } from '../stores/useUiStore'

const LOCALE_MAP = { en: 'en-US', es: 'es-ES', cat: 'ca-ES' } as const

function toUTCDate(iso: string): Date {
  const hasTZ = /(Z|[+-]\d{2}:\d{2})$/i.test(iso)
  const d = new Date(hasTZ ? iso : iso + 'Z')
  if (isNaN(d.getTime())) throw new Error('Fecha inválida')
  return d
}

export function formatUiDate(iso: string): string {
  const ui = useUiStore() // Pinia

  const locale = LOCALE_MAP[ui.lang as keyof typeof LOCALE_MAP]
  let d
  try {
    d = toUTCDate(iso)
  } catch {
    return ''
  }
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}
