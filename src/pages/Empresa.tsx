import { Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { formatFecha, formatRuc } from '@/lib/format'

/**
 * Solo lectura: los datos de la empresa los edita el super_admin desde
 * /admindrpcs, en linea con que aca no hay diferencia de permisos entre
 * admin y usuario (RLS solo deja UPDATE en `empresas` al super_admin).
 */
export default function Empresa() {
  const { empresa } = useAuth()

  if (!empresa) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">No estas asignado a ninguna empresa.</p>
      </div>
    )
  }

  const campos: Array<[string, string]> = [
    ['RUC', formatRuc(empresa.ruc)],
    ['Email', empresa.email || '—'],
    ['Telefono', empresa.telefono || '—'],
    ['Direccion', empresa.direccion || '—'],
    ['Alta', formatFecha(empresa.created_at)],
  ]

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Building2 className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Mi empresa</h1>
      </div>

      <Card className="max-w-lg">
        <CardHeader
          title={empresa.nombre}
          action={<Badge tono={empresa.activo ? 'success' : 'neutral'}>{empresa.activo ? 'Activo' : 'Inactivo'}</Badge>}
        />
        <CardBody>
          <dl className="space-y-3">
            {campos.map(([label, valor]) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right text-foreground">{valor}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-muted-foreground">
            Para modificar estos datos, contactate con el administrador del sistema.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
