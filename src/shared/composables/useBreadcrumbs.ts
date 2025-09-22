import { computed } from 'vue'
import { useRoute } from 'vue-router'

function useBreadcrumbs() {
  const route = useRoute()

  const breadcrumbs = computed(() => {
    const matched = route.matched.map((r) => {
      const title = r.meta.childLabel ?? r.meta.title
      const titleValue = typeof title === 'function' ? title() : title

      return {
        name: titleValue,
        pathName: r.name,
      }
    })

    const all = [{ name: 'Portal SED', pathName: 'app.home' }, ...matched]

    if (all.length <= 4) {
      return all
    }

    return [all[0], all[1], { name: '...', pathName: '' }, all[all.length - 1]]
  })

  return { breadcrumbs }
}

export default useBreadcrumbs
