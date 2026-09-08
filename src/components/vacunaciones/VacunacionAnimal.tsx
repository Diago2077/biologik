import { Syringe, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Cargando } from '@/components/ui/estado'
import { useAuth } from '@/hooks/useAuth'
import { useVacunaciones } from '@/hooks/useVacunaciones'
import { formatFecha } from '@/lib/format'
import { calcularCronograma, planDeEmpresa, textoRestante } from '@/lib/vacunacion'
import { EstadoVacunacionBadge } from './EstadoBadge'

function ordinal(n: number): string {
  return n === 1 ? '1ra dosis' : `${n}ª dosis`
}

/** Dosis aplicadas a un animal y cuando le toca la proxima. */
export function VacunacionAnimal({ animalId }: { animalId: string }) {
  const { empresa, puedeEditar } = useAuth()
  const { data: dosis, loading, eliminar } = useVacunaciones(animalId)

  const cronograma = calcularCronograma(
    dosis.map((d) => ({ numero_dosis: d.numero_dosis, fecha_aplicada: d.fecha_aplicada })),
    planDeEmpresa(empresa),
  )

  async function onEliminar(id: string) {
    const { error } = await eliminar(id)
    if (error) toast.error(error)
    else toast.success('Dosis eliminada')
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Syringe className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Vacunación</h2>
        </div>
        <div className="flex items-center gap-2">
          <EstadoVacunacionBadge estado={cronograma.estado} />
          <span className="text-xs text-muted-foreground">
            {cronograma.proximaFecha
              ? `${ordinal(cronograma.proximaDosis)}: ${formatFecha(cronograma.proximaFecha)} · ${textoRestante(cronograma)}`
              : 'Todavía no recibió la primera dosis'}
          </span>
        </div>
      </div>

      {loading ? (
        <Cargando className="py-6" />
      ) : dosis.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Sin dosis registradas. Se cargan desde la finca, con “Registrar vacunación”.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Dosis</th>
              <th className="px-4 py-2 font-medium">Aplicada</th>
              <th className="px-4 py-2 font-medium">Producto</th>
              {puedeEditar && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dosis.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2 font-medium text-foreground">{ordinal(d.numero_dosis)}</td>
                <td className="px-4 py-2 text-muted-foreground">{formatFecha(d.fecha_aplicada)}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {[d.producto, d.lote].filter(Boolean).join(' · ') || '—'}
                </td>
                {puedeEditar && (
                  <td className="px-2 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar dosis"
                      onClick={() => onEliminar(d.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
