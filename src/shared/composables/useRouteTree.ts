// useRouteTree.ts
import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores'
import type { RouteRecordRaw, RouteRecordName } from 'vue-router'
import type { Tree, TreeNode } from '../types'

const OTHER = 'Otras Soluciones'
const SEP = '::' as const

type Label = string | (() => string)

// Minimal meta understood by the builder (no solutionId needed anymore)
type RouteMetaExt = {
  title?: Label
  category?: string
  /** Short label for child pages inside a folder (e.g., "Inicio", "Base de datos") */
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

/** Builds categorized nodes. Records route.name -> solutionId (parsed from name). */
function buildCategorized(
  route: RouteRecordRaw,
  inheritedCategory?: string,
  routeToSolution?: Map<string, string>,
): { category?: string; node: TreeNode }[] {
  const meta = (route.meta ?? {}) as RouteMetaExt
  const category = meta.category ?? inheritedCategory

  // Identify index child (path === '') if present and named
  const indexChild = (route.children ?? []).find((c) => c.path === '' && isStrName(c.name))
  const indexChildName =
    indexChild?.name && isStrName(indexChild.name) ? indexChild.name : undefined

  // Recurse first so children are ready and routeToSolution is filled for them
  const childCats = (route.children ?? []).flatMap((c) =>
    buildCategorized(c, category, routeToSolution),
  )

  // Helper to remove the index child node from the children list (we don't want to list it)
  const withoutIndex = (nodes: { category?: string; node: TreeNode }[]) =>
    indexChildName ? nodes.filter((c) => c.node.route !== indexChildName) : nodes

  // If the route has an index child: create a "folder proxy" node.
  if (indexChildName) {
    // Folder label: prefer parent's title; fallback to index child label; finally parent's name/index name
    const fallbackName: Label =
      meta.title ??
      ((): Label => {
        const idxNode = childCats.find((c) => c.node.route === indexChildName)?.node
        return idxNode?.name ?? (isStrName(route.name) ? route.name : indexChildName)
      })()

    const node: TreeNode = {
      name: fallbackName,
      // Clicking the folder should route to the index child
      route: indexChildName,
      // Children exclude the index child (optional to show later as "Inicio")
      children: childCats.length ? withoutIndex(childCats).map((c) => c.node) : undefined,
    }

    // Map the index child name to its solutionId (parsed from its own name)
    const parsedIdx = parseName(indexChildName)
    if (parsedIdx.solutionId && routeToSolution)
      routeToSolution.set(indexChildName, parsedIdx.solutionId)

    return [{ category, node }]
  }

  // No index child: create a node only if the current route has a string name
  if (isStrName(route.name)) {
    const name: Label = meta.childLabel ?? meta.title ?? route.name
    const node: TreeNode = {
      name,
      route: route.name,
      children: childCats.length ? childCats.map((c) => c.node) : undefined,
    }

    // Map this route name to its solutionId (parsed from its own name)
    const parsed = parseName(route.name)
    if (parsed.solutionId && routeToSolution) routeToSolution.set(route.name, parsed.solutionId)

    return [{ category, node }]
  }

  // Anonymous parent without index child: bubble up children
  return childCats
}

/** Build categorized tree and mapping route.name -> solutionId. Keeps OTHER at the end. */
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

/**
 * Filter by allowed codes (route names and/or solutionIds).
 * Keeps parents if any child remains after filtering.
 */
function filterTree(
  tree: Tree,
  allowed: ReadonlySet<string>,
  routeToSolution: ReadonlyMap<string, string>,
): Tree {
  const isAllowedRouteOrSolution = (routeName: string): boolean => {
    if (allowed.has(routeName)) return true
    const mapped = routeToSolution.get(routeName)
    if (mapped && allowed.has(mapped)) return true
    // Fallback: parse directly in case the map missed an entry
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

  // Ensure OTHER is always last if present
  if (OTHER in out) {
    const tmp = out[OTHER]
    delete (out as Record<string, TreeNode[]>)[OTHER]
    out[OTHER] = tmp
  }
  return out
}

/** Composable: builds and filters reactively using auth.soluciones (by route name OR solutionId parsed from name). */
function useRouteTree(routes: ReadonlyArray<RouteRecordRaw>) {
  const auth = useAuthStore()

  const built = computed(() => buildTreeFromRoutes(routes))

  const filteredTree = computed(() => {
    // Allowed codes may contain full route names and/or solutionIds
    const allowed = new Set<string>(auth.soluciones.map((s) => s.codigo))
    return filterTree(built.value.tree, allowed, built.value.routeToSolution)
  })

  return {
    // Full tree (uncut) for debugging/QA
    debugTree: computed(() => built.value.tree),
    // Filtered tree according to auth.soluciones
    tree: filteredTree,
  }
}

export default useRouteTree
