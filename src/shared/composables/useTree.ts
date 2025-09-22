import { computed, ref } from 'vue'
import type { TreeNode, Tree } from '@/shared/types'

function useTree(tree: Tree) {
  const search = ref('')

  function normalize(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // removes accents
      .replace(/ñ/g, 'n')
      .replace(/Ñ/g, 'n')
      .toLowerCase()
  }

  function filterNode(node: TreeNode, query: string): TreeNode | null {
    const name = typeof node.name === 'function' ? node.name() : node.name
    if (normalize(name).includes(query) || normalize(node.route).includes(query)) {
      return node
    }

    if (!node.children) return null

    const filteredChildren = node.children
      .map((child) => filterNode(child, query))
      .filter((child): child is TreeNode => child !== null)

    return filteredChildren.length > 0 ? { ...node, children: filteredChildren } : null
  }

  function filterTree(tree: Tree, query: string): Tree {
    const result: Tree = {}
    const nq = normalize(query)

    for (const [categoria, values] of Object.entries(tree)) {
      if (normalize(categoria).includes(nq)) {
        result[categoria] = values
        continue
      }

      const filtered = values
        .map((node) => filterNode(node, nq))
        .filter((node): node is TreeNode => node !== null)

      if (filtered.length > 0) {
        result[categoria] = filtered
      }
    }

    return result
  }

  const filteredTree = computed(() => {
    if (!search.value) return tree
    return filterTree(tree, search.value)
  })

  const isEmpty = computed(() => {
    const t = filteredTree.value
    return Object.keys(t).length === 0 || Object.values(t).every((nodes) => nodes.length === 0)
  })

  return {
    search,
    filteredTree,
    isEmpty,
  }
}

export default useTree
