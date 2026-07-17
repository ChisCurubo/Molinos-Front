import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui'

export function NoAccessPage() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <div className="empty" style={{ paddingTop: 80 }}>
        <ShieldAlert size={56} color="var(--brown-500)" aria-hidden="true" />
        <h1 className="page__title">Acceso restringido</h1>
        <p className="page__subtitle" style={{ textAlign: 'center' }}>
          Su rol no tiene permiso para ver esta sección. Si cree que es un error, contacte al administrador.
        </p>
        <Button onClick={() => navigate('/')}>Volver al panel principal</Button>
      </div>
    </div>
  )
}
