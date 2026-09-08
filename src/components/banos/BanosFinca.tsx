import { Droplets, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Cargando } from '@/components/ui/estado'
import { useAuth } from '@/hooks/useAuth'
import { useBanos } from '@/hooks/useBanos'
import {
  banosUltimoAno,
  conIntervalos,
  diasDesdeUltimo,
  promedioIntervalo,
  tendenciaIntervalo,
} from '@/lib/banos'
import { formatFecha } from '@/lib/format'
import { BanoFormModal } from './BanoFormModal'

/**
 * Baños acaricidas de una finca y el intervalo entre ellos.
 *
 * El intervalo es LA metrica del programa de control integrado: si crece,
 * cada vez hace falta bañar menos seguido, que es el ahorro concreto que ve
 * el productor.
 */
export function BanosFinca({ fincaId }: { fincaId: string }) {
  const { puedeEditar } = useAuth()
  const { data: banos, loading, refetch, crear, eliminar } = useBanos(fincaId)
  const [modal, setModal] = useState(false)

  const fechas = banos.map((b) => b.fecha)
  const filas = conIntervalos(fechas)
  const promedio = promedioIntervalo(fechas)
  const desdeUltimo = diasDesdeUltimo(fechas)
  const ultimoAno = banosUltimoAno(fechas)
  const tendencia = tendenciaIntervalo(fechas)

  async function onEliminar(id: string) {
    const { error } = await eliminar(id)
    if (error) toast.error(error)
    else toast.success('Baño eliminado')
  }

  return (
    <div className="mb-5 rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Droplets className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Baños acaricidas</h2>
        </div>
        {puedeEditar && (
          <Button variant="outline" size="sm" onClick={() => setModal(true)}>
            <Plus /> Registrar baño
          </Button>
        )}
      </div>

      {loading ? (
        <Cargando className="py-6" />
      ) : banos.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no hay baños registrados. Cargarlos es lo que permite medir si la vacunación
          está alargando el tiempo entre tratamientos.
        </p>
      ) : (
        <>
          <div className="grid gap-px border-b border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Dato
              etiqueta="Último baño"
              valor={desdeUltimo === null ? '—' : `hace ${desdeUltimo} d`}
              nota={formatFecha(fechas[0])}
            />
            <Dato
              etiqueta="Intervalo promedio"
              valor={promedio === null ? '—' : `${promedio} días`}
              nota={promedio === null ? 'Hace falta un segundo baño' : 'Entre baños consecutivos'}
              destacado
            />
            <Dato
              etiqueta="Baños del último año"
              valor={String(ultimoAno)}
              nota="En los últimos 365 días"
            />
            <Dato
              etiqueta="Tendencia"
              valor={
                tendencia
                  ? `${tendencia.variacionPct > 0 ? '+' : ''}${tendencia.variacionPct}%`
                  : '—'
              }
              nota={
                tendencia
                  ? `${tendencia.recientes} d ahora vs ${tendencia.previos} d antes`
                  : 'Hacen falta 4 baños'
              }
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 text-right font-medium">Desde el anterior</th>
                  <th className="px-4 py-2 font-medium">Producto</th>
                  {puedeEditar && <th className="w-10 px-2 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {banos.map((b, i) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2 font-medium text-foreground">{formatFecha(b.fecha)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {filas[i].dias === null ? '—' : `${filas[i].dias} días`}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{b.producto || '—'}</td>
                    {puedeEditar && (
                      <td className="px-2 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar baño"
                          onClick={() => onEliminar(b.id)}
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
          </div>
        </>
      )}

      <BanoFormModal
        abierto={modal}
        crear={crear}
        onCerrar={() => setModal(false)}
        onGuardado={() => {
          setModal(false)
          refetch()
        }}
      />
    </div>
  )
}

function Dato({
  etiqueta,
  valor,
  nota,
  destacado,
}: {
  etiqueta: string
  valor: string
  nota?: string
  destacado?: boolean
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p
        className={
          'mt-1 text-xl font-semibold tabular-nums ' +
          (destacado ? 'text-primary' : 'text-foreground')
        }
      >
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
    </div>
  )
}
