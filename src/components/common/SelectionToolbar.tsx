import { Download } from 'lucide-react'
import { Button } from '@/components/ui'

interface SelectionToolbarProps {
  count: number
  onlySelected: boolean
  onToggleOnlySelected: () => void
  onExport: () => void
}

/** Botones "Ver seleccionados" + "Exportar a Excel" para tablas con checkboxes por fila. */
export function SelectionToolbar({ count, onlySelected, onToggleOnlySelected, onExport }: SelectionToolbarProps) {
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
      {count > 0 && (
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
          {count} seleccionado{count === 1 ? '' : 's'}
        </span>
      )}
      <Button size="sm" variant="secondary" disabled={count === 0} onClick={onToggleOnlySelected}>
        {onlySelected ? 'Ver todos' : 'Ver seleccionados'}
      </Button>
      <Button size="sm" disabled={count === 0} icon={<Download size={14} />} onClick={onExport}>
        Exportar a Excel
      </Button>
    </div>
  )
}
