// useRouteTree.ts
import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores'
import type { RouteRecordRaw, RouteRecordName } from 'vue-router'
import type { Tree, TreeNode } from '../types'

const OTHER = 'Otras Soluciones'

type RouteMetaExt = {
  title?: string | (() => string)
  category?: string
}

const isStrName = (n: RouteRecordName | undefined): n is string =>
  typeof n === 'string' && n.length > 0

/** Construye nodos preservando jerarquía e “heredando” category. */
function buildCategorized(
  route: RouteRecordRaw,
  inheritedCategory?: string,
): { category?: string; node: TreeNode }[] {
  const meta = (route.meta ?? {}) as RouteMetaExt
  const category = meta.category ?? inheritedCategory

  const childCats = (route.children ?? []).flatMap((c) => buildCategorized(c, category))

  // Sólo creamos nodo si la ruta tiene name string
  if (isStrName(route.name)) {
    const node: TreeNode = {
      name: meta.title ?? route.name, // fallback
      route: route.name,
      children: childCats.length ? childCats.map((c) => c.node) : undefined,
    }
    return [{ category, node }]
  }

  // Sin name => no nodo propio; devolvemos hijos
  return childCats
}

/** Agrupa por categoría y deja OTHER al final. */
function buildTreeFromRoutes(routes: ReadonlyArray<RouteRecordRaw>): Tree {
  const collected = routes.flatMap((r) => buildCategorized(r))
  const map = new Map<string, TreeNode[]>()
  for (const { category, node } of collected) {
    const key = category && category.trim() ? category : OTHER
    ;(map.get(key) ?? map.set(key, []).get(key)!).push(node)
  }
  const out: Tree = {}
  for (const [k, v] of map) if (k !== OTHER) out[k] = v
  if (map.has(OTHER)) out[OTHER] = map.get(OTHER)!
  return out
}

/** Filtra por códigos permitidos (route.name). Mantiene padres si hay hijos permitidos. */
function filterTree(tree: Tree, allowed: Set<string>): Tree {
  const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
    const mapped = nodes.map((n) => {
      const children = n.children ? filterNodes(n.children) : undefined
      return allowed.has(n.route) || (children && children.length > 0) ? { ...n, children } : null
    })
    return mapped.filter((m) => m != null)
  }

  const out: Tree = {}
  for (const [cat, nodes] of Object.entries(tree)) {
    const nn = filterNodes(nodes)
    if (nn.length > 0) out[cat] = nn
  }
  // Asegurar OTHER al final si quedó algo
  if (OTHER in out) {
    const temp = out[OTHER]
    delete (out as Record<string, TreeNode[]>)[OTHER]
    out[OTHER] = temp
  }
  return out
}

/** Composable: genera y filtra reactivo en función de auth.soluciones */
function useRouteTree(routes: ReadonlyArray<RouteRecordRaw>) {
  const auth = useAuthStore()
  const tree = computed(() => buildTreeFromRoutes(routes))
  const filteredTree = computed(() => {
    const allowed = new Set<string>(auth.soluciones.map((s) => s.codigo))
    return filterTree(tree.value, allowed)
  })

  return {
    debugTree: tree, // árbol completo
    tree: filteredTree, // árbol filtrado por auth.soluciones
  }
}

export default useRouteTree
