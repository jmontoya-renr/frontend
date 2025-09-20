export type Tree = Record<string, TreeNode[]>

export default interface TreeNode {
  name: string | (() => string)
  route: string
  children?: Array<TreeNode>
}
