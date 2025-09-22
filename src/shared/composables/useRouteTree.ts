import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores'
import type { RouteRecordRaw, RouteRecordName } from 'vue-router'
import type { Tree, TreeNode } from '../types'

const OTHER = 'Otras Soluciones'
const SEP = '::' as const

type Label = string | (() => string)

type RouteMetaExt = {
  title?: Label
  category?: string
  childLabel?: Label
}

const isStrName = (n: RouteRecordName | undefined): n is string =>
  typeof n === 'string' && n.length > 0

type ParsedName = { solutionId?: string; pageCode: string }
function parseName(n: RouteRecordName | undefined): ParsedName {
  if (typeof n !== 'string' || n.length === 0) return { pageCode: '' }
  const i = n.indexOf(SEP)
  return i === -1
    ? { pageCode: n }
    : { solutionId: n.slice(0, i), pageCode: n.slice(i + SEP.length) }
}

function buildCategorized(
  route: RouteRecordRaw,
  inheritedCategory?: string,
  routeToSolution?: Map<string, string>,
): { category?: string; node: TreeNode }[] {
  const meta = (route.meta ?? {}) as RouteMetaExt
  const category = meta.category ?? inheritedCategory

  const indexChild = (route.children ?? []).find((c) => c.path === '' && isStrName(c.name))
  const indexChildName =
    indexChild?.name && isStrName(indexChild.name) ? indexChild.name : undefined

  const childCats = (route.children ?? []).flatMap((c) =>
    buildCategorized(c, category, routeToSolution),
  )

  const withoutIndex = (nodes: { category?: string; node: TreeNode }[]) =>
    indexChildName ? nodes.filter((c) => c.node.route !== indexChildName) : nodes

  if (indexChildName) {
    const fallbackName: Label =
      meta.title ??
      ((): Label => {
        const idxNode = childCats.find((c) => c.node.route === indexChildName)?.node
        return idxNode?.name ?? (isStrName(route.name) ? route.name : indexChildName)
      })()

    const node: TreeNode = {
      name: fallbackName,
      route: indexChildName,
      children: childCats.length ? withoutIndex(childCats).map((c) => c.node) : undefined,
    }

    const parsedIdx = parseName(indexChildName)
    if (parsedIdx.solutionId && routeToSolution)
      routeToSolution.set(indexChildName, parsedIdx.solutionId)

    return [{ category, node }]
  }

  if (isStrName(route.name)) {
    const name: Label = meta.childLabel ?? meta.title ?? route.name
    const node: TreeNode = {
      name,
      route: route.name,
      children: childCats.length ? childCats.map((c) => c.node) : undefined,
    }

    const parsed = parseName(route.name)
    if (parsed.solutionId && routeToSolution) routeToSolution.set(route.name, parsed.solutionId)

    return [{ category, node }]
  }

  return childCats
}

function buildTreeFromRoutes(routes: ReadonlyArray<RouteRecordRaw>): {
  tree: Tree
  routeToSolution: Map<string, string>
} {
  const routeToSolution = new Map<string, string>()
  const collected = routes.flatMap((r) => buildCategorized(r, undefined, routeToSolution))

  const map = new Map<string, TreeNode[]>()
  for (const { category, node } of collected) {
    const key = category && category.trim() ? category : OTHER
    ;(map.get(key) ?? map.set(key, []).get(key)!).push(node)
  }

  const out: Tree = {}
  for (const [k, v] of map) if (k !== OTHER) out[k] = v
  if (map.has(OTHER)) out[OTHER] = map.get(OTHER)!
  return { tree: out, routeToSolution }
}

function filterTree(
  tree: Tree,
  allowed: ReadonlySet<string>,
  routeToSolution: ReadonlyMap<string, string>,
): Tree {
  const isAllowedRouteOrSolution = (routeName: string): boolean => {
    if (allowed.has(routeName)) return true
    const mapped = routeToSolution.get(routeName)
    if (mapped && allowed.has(mapped)) return true
    const parsed = parseName(routeName)
    return !!parsed.solutionId && allowed.has(parsed.solutionId)
  }

  const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
    const mapped = nodes.map<TreeNode | null>((n) => {
      const children = n.children ? filterNodes(n.children) : undefined
      const keepSelf = isAllowedRouteOrSolution(n.route)
      const keep = keepSelf || (children && children.length > 0)
      return keep ? { ...n, children } : null
    })
    return mapped.filter((m): m is TreeNode => m != null)
  }

  const out: Tree = {}
  for (const [cat, nodes] of Object.entries(tree)) {
    const nn = filterNodes(nodes)
    if (nn.length > 0) out[cat] = nn
  }

  if (OTHER in out) {
    const tmp = out[OTHER]
    delete (out as Record<string, TreeNode[]>)[OTHER]
    out[OTHER] = tmp
  }
  return out
}

function useRouteTree(routes: ReadonlyArray<RouteRecordRaw>) {
  const auth = useAuthStore()

  const built = computed(() => buildTreeFromRoutes(routes))

  const filteredTree = computed(() => {
    const allowed = new Set<string>(auth.soluciones.map((s) => s.codigo))
    return filterTree(built.value.tree, allowed, built.value.routeToSolution)
  })

  return {
    debugTree: computed(() => built.value.tree),
    tree: filteredTree,
  }
}

export default useRouteTree
