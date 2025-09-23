import { computed, watchEffect, type Ref } from 'vue'
import { useVirtualizer, type VirtualItem } from '@tanstack/vue-virtual'

type ScrollAlign = 'auto' | 'center' | 'end' | 'start'

export function useVirtualRows(opts: {
  containerRef: Ref<HTMLElement | null>
  rowCount: () => number
  hasNextPage: () => boolean
  isLoadingAnything: () => boolean
  loadMore?: () => void | Promise<void>
  estimateSize?: number
  overscan?: number
  prefetchGap?: number
  skeletonRows?: number
}) {
  const rowVirtualizer = useVirtualizer(
    computed(() => ({
      count: opts.hasNextPage() ? opts.rowCount() + (opts.skeletonRows ?? 1) : opts.rowCount(),
      getScrollElement: () => opts.containerRef.value,
      estimateSize: () => opts.estimateSize ?? 40,
      overscan: opts.overscan ?? 5,
    })),
  )

  const virtualRows = computed<VirtualItem[]>(() => rowVirtualizer.value.getVirtualItems())
  const totalSize = computed<number>(() => rowVirtualizer.value.getTotalSize())
  const isLoaderIndex = (i: number): boolean => i >= opts.rowCount()

  const canAskMore = computed<boolean>(() => !!opts.hasNextPage() && !opts.isLoadingAnything())

  async function triggerLoadMore(): Promise<void> {
    if (opts.loadMore) await opts.loadMore()
  }

  watchEffect(() => {
    if (!canAskMore.value) return
    const list = virtualRows.value
    if (!list.length || opts.rowCount() === 0) return
    const last = list[list.length - 1]
    const reachedEnd = last.index >= opts.rowCount() - 1 - (opts.prefetchGap ?? 0)
    if (reachedEnd) {
      void triggerLoadMore()
    }
  })

  const scrollToIndex = (index: number, opts2?: { align?: ScrollAlign }) =>
    rowVirtualizer.value.scrollToIndex(index, opts2)

  return {
    rowVirtualizer,
    virtualRows,
    totalSize,
    isLoaderIndex,
    scrollToIndex,
  }
}
