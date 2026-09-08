import { Syringe } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Select } from '@/components/ui/field'
import { EstadoVacunacionBadge } from '@/components/vacunaciones/EstadoBadge'
import { useAuth } from '@/hooks/useAuth'
import { useVacunacionesPendientes } from '@/hooks/useVacunacionesPendientes'
import { formatFecha, formatNumero } from '@/lib/format'
import {
  ESTADO_LABEL,
  planDeEmpresa,
  textoRestante,
  type EstadoVacunacion,
} from '@/lib/vacunacion'

type Filtro = 'pendientes' | 'todos' | EstadoVacunacion

export default function Vacunaciones() {
  const navigate = useNavigate()
  const { empresa } = useAuth()
  const { data, loading, error, vencidas, porVencer } = useVacunacionesPendientes()
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const diasAviso = planDeEmpresa(empresa).diasAviso

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return data
    if (filtro === 'pendientes') {
      return data.filter(
        (p) => p.cronograma.estado === 'vencida' || p.cronograma.estado === 'por_vencer',
      )
    }
    return data.filter((p) => p.cronograma.estado === filtro)
  }, [data, filtro])

  const sinIniciar = data.filter((p) => p.cronograma.estado === 'sin_iniciar').length

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">Vacunaciones</h1>
        <p className="text-sm text-muted-foreground">
          Cuándo le toca la próxima dosis a cada animal. Las dosis se registran desde la finca.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Tarjeta etiqueta="Vencidas" valor={formatNumero(vencidas)} tono={vencidas > 0 ? 'danger' : undefined} />
        <Tarjeta etiqueta="Por vencer" valor={formatNumero(porVencer)} tono={porVencer > 0 ? 'warning' : undefined} />
        <Tarjeta etiqueta="Sin primera dosis" valor={formatNumero(sinIniciar)} />
      </div>

      <div className="mb-4 max-w-xs">
        <Select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          <option value="pendientes">Pendientes (vencidas y por vencer)</option>
          <option value="todos">Todos los animales</option>
          <option value="vencida">{ESTADO_LABEL.vencida}</option>
          <option value="por_vencer">{ESTADO_LABEL.por_vencer}</option>
          <option value="al_dia">{ESTADO_LABEL.al_dia}</option>
          <option value="sin_iniciar">{ESTADO_LABEL.sin_iniciar}</option>
        </Select>
      </div>

      {error && <ErrorBox mensaje={error} />}
      {loading && <Cargando />}

      {!loading && !error && filtrados.length === 0 && (
        <div className="rounded-lg border border-border bg-card">
          <Vacio
            icono={Syringe}
            titulo={filtro === 'pendientes' ? 'No hay vacunaciones pendientes' : 'Sin resultados'}
            descripcion={
              filtro === 'pendientes'
                ? `Ningún animal tiene una dosis vencida ni por vencer en los próximos ${diasAviso} días.`
                : 'Probá con otro filtro.'
            }
          />
        </div>
      )}

      {!loading && !error && filtrados.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Caravana</th>
                <th className="px-4 py-2.5 font-medium">Finca</th>
                <th className="px-4 py-2.5 font-medium">Última dosis</th>
                <th className="px-4 py-2.5 font-medium">Próxima</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtrados.map(({ animal, finca, cronograma }) => (
                <tr
                  key={animal.id}
                  onClick={() => navigate(`/animales/${animal.id}`)}
                  className="cursor-pointer select-none transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{animal.caravana}</td>
                  <td className="px-4 py-3 text-muted-foreground">{finca?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cronograma.ultimaFecha
                      ? `${cronograma.ultimaDosis}ª · ${formatFecha(cronograma.ultimaFecha)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {cronograma.proximaFecha ? (
                      <>
                        <span className="font-medium">{cronograma.proximaDosis}ª</span>{' '}
                        {formatFecha(cronograma.proximaFecha)}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {textoRestante(cronograma)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Falta la 1ra dosis</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <EstadoVacunacionBadge estado={cronograma.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Tarjeta({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string
  valor: string
  tono?: 'danger' | 'warning'
}) {
  const color =
    tono === 'danger' ? 'text-destructive' : tono === 'warning' ? 'text-warning' : 'text-foreground'
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{valor}</p>
    </div>
  )
}
