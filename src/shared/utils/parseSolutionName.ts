import type { RouteRecordName } from 'vue-router'

const SEP = '::' as const

export type ParsedName = { solutionId?: string; pageCode: string }

export function parseSolutionName(n: RouteRecordName | null | undefined): ParsedName {
  if (typeof n !== 'string' || n.length === 0) return { pageCode: '' }
  const i = n.indexOf(SEP)
  return i === -1
    ? { pageCode: n }
    : { solutionId: n.slice(0, i), pageCode: n.slice(i + SEP.length) }
}
