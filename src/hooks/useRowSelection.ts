import { useMemo, useState } from 'react'

/** Selección de filas por id + toggle "ver solo seleccionados", reusable en cualquier tabla. */
export function useRowSelection<T>(items: T[], getId: (item: T) => string | number) {
  const [selected, setSelected] = useState<Set<string | number>>(new Set())
  const [onlySelected, setOnlySelected] = useState(false)

  const toggle = (item: T) => {
    const id = getId(item)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isSelected = (item: T) => selected.has(getId(item))

  const selectedItems = useMemo(
    () => items.filter((it) => selected.has(getId(it))),
    [items, selected, getId],
  )

  const visibleItems = onlySelected ? selectedItems : items

  return {
    count: selected.size,
    toggle,
    isSelected,
    selectedItems,
    visibleItems,
    onlySelected,
    setOnlySelected,
  }
}
