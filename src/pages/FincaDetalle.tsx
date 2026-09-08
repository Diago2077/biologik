import { AlertTriangle, ArrowLeft, Beef, Pencil, Plus, Search, Syringe } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimalFormModal } from '@/components/animales/AnimalFormModal'
import { BanosFinca } from '@/components/banos/BanosFinca'
import { FincaFormModal } from '@/components/fincas/FincaFormModal'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Input } from '@/components/ui/field'
import { EstadoVacunacionBadge } from '@/components/vacunaciones/EstadoBadge'
import { VacunacionMasivaModal } from '@/components/vacunaciones/VacunacionMasivaModal'
import { useAnimales } from '@/hooks/useAnimales'
import { useAuth } from '@/hooks/useAuth'
import { useFinca } from '@/hooks/useFincas'
import { formatFecha, formatNumero, normalizar } from '@/lib/format'
import { nivelInfestacion, UMBRAL_POR_DEFECTO } from '@/lib/umbral'
import { textoRestante } from '@/lib/vacunacion'

export default function FincaDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { empresa } = useAuth()
  const { data: finca, loading: cargandoFinca, refetch: refetchFinca } = useFinca(id)
  const { data: animales, muestreos, loading, error, refetch } = useAnimales(id)
  const umbral = empresa?.umbral_garrapatas ?? UMBRAL_POR_DEFECTO

  const [busqueda, setBusqueda] = useState('')
  const [modalAnimal, setModalAnimal] = useState(false)
  const [modalFinca, setModalFinca] = useState(false)
  const [modalVacuna, setModalVacuna] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return animales
    return animales.filter((a) => normalizar(a.caravana).includes(q))
  }, [animales, busqueda])

  const ultimo = muestreos[0] ?? null
  const anterior = muestreos[1] ?? null
  const pendientes = animales.filter(
    (a) => a.cronograma.estado === 'vencida' || a.cronograma.estado === 'por_vencer',
  ).length
  const sobreUmbral = animales.filter(
    (a) => a.ultima_carga !== null && a.ultima_carga >= umbral,
  ).length

  if (cargandoFinca) return <Cargando />
  if (!finca) return <ErrorBox mensaje="No se encontró la finca." />

  return (
    <div>
      <Link
        to="/fincas"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Fincas
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">{finca.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {[finca.propietario, finca.ciudad].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setModalFinca(true)}>
            <Pencil /> Editar finca
          </Button>
          <Button variant="outline" onClick={() => setModalVacuna(true)} disabled={animales.length === 0}>
            <Syringe /> Registrar vacunación
          </Button>
          <Button onClick={() => setModalAnimal(true)}>
            <Plus /> Nuevo animal
          </Button>
        </div>
      </div>

      {sobreUmbral > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {sobreUmbral === 1
                ? '1 animal supera el umbral de infestación'
                : `${sobreUmbral} animales superan el umbral de infestación`}
            </p>
            <p className="text-xs text-muted-foreground">
              El umbral está en {umbral} garrapatas por animal. Considerá un baño acaricida.
            </p>
          </div>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Resumen etiqueta="Animales" valor={formatNumero(animales.length)} />
        <Resumen
          etiqueta="Promedio último muestreo"
          valor={ultimo ? formatNumero(ultimo.promedio) : '—'}
          nota={
            ultimo
              ? `${formatFecha(ultimo.fecha)} · ${ultimo.animales_medidos} ${ultimo.animales_medidos === 1 ? 'animal' : 'animales'}`
              : 'Todavía sin conteos'
          }
          destacado
        />
        <Resumen
          etiqueta="Contra el anterior"
          valor={ultimo && anterior ? variacion(anterior.promedio, ultimo.promedio) : '—'}
          nota={anterior ? `Era ${formatNumero(anterior.promedio)} el ${formatFecha(anterior.fecha)}` : 'Falta un segundo muestreo'}
        />
        <Resumen
          etiqueta="Vacunaciones pendientes"
          valor={formatNumero(pendientes)}
          nota={pendientes > 0 ? 'Vencidas o por vencer' : 'Nada por ahora'}
        />
      </div>

      {muestreos.length > 1 && (
        <div className="mb-5 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="border-b border-border bg-secondary/40 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evolución de la carga
            </caption>
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 text-right font-medium">Promedio</th>
                <th className="px-4 py-2 text-right font-medium">Animales medidos</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {muestreos.map((m) => (
                <tr key={m.fecha}>
                  <td className="px-4 py-2 text-foreground">{formatFecha(m.fecha)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-foreground">
                    {formatNumero(m.promedio)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {m.animales_medidos}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {formatNumero(m.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BanosFinca fincaId={finca.id} />

      {animales.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por caravana…"
            className="pl-9"
            type="search"
          />
        </div>
      )}

      {error && <ErrorBox mensaje={error} />}
      {loading && <Cargando />}

      {!loading && !error && animales.length === 0 && (
        <div className="rounded-lg border border-border bg-card">
          <Vacio
            icono={Beef}
            titulo="Todavía no hay animales"
            descripcion="Cargá el primer animal con su número de caravana para poder registrarle conteos y vacunaciones."
            accion={
              <Button onClick={() => setModalAnimal(true)}>
                <Plus /> Nuevo animal
              </Button>
            }
          />
        </div>
      )}

      {!loading && !error && animales.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Caravana</th>
                <th className="px-4 py-2.5 text-right font-medium">Última carga</th>
                <th className="px-4 py-2.5 text-right font-medium">Promedio</th>
                <th className="px-4 py-2.5 font-medium">Último muestreo</th>
                <th className="px-4 py-2.5 font-medium">Vacunación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtrados.map((animal) => (
                <tr
                  key={animal.id}
                  onClick={() => navigate(`/animales/${animal.id}`)}
                  className="cursor-pointer select-none transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{animal.caravana}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {animal.ultima_carga === null ? (
                      <span className="text-foreground">—</span>
                    ) : (
                      <span
                        className={
                          nivelInfestacion(animal.ultima_carga, umbral) === 'supera'
                            ? 'text-destructive'
                            : nivelInfestacion(animal.ultima_carga, umbral) === 'cerca'
                              ? 'text-warning'
                              : 'text-foreground'
                        }
                        title={
                          animal.ultima_carga >= umbral
                            ? `Supera el umbral de ${umbral}`
                            : undefined
                        }
                      >
                        {animal.ultima_carga}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {animal.promedio_carga ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {animal.ultimo_conteo ? formatFecha(animal.ultimo_conteo) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <EstadoVacunacionBadge estado={animal.cronograma.estado} />
                      <span className="text-xs text-muted-foreground">
                        {animal.cronograma.estado === 'sin_iniciar'
                          ? '1ra dosis'
                          : `${animal.cronograma.proximaDosis}ª · ${textoRestante(animal.cronograma)}`}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No se encontraron animales con esa búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnimalFormModal
        abierto={modalAnimal}
        fincaId={finca.id}
        animal={null}
        onCerrar={() => setModalAnimal(false)}
        onGuardado={() => {
          setModalAnimal(false)
          refetch()
        }}
      />

      <FincaFormModal
        abierto={modalFinca}
        finca={finca}
        onCerrar={() => setModalFinca(false)}
        onGuardado={() => {
          setModalFinca(false)
          refetchFinca()
        }}
      />

      <VacunacionMasivaModal
        abierto={modalVacuna}
        animales={animales}
        onCerrar={() => setModalVacuna(false)}
        onAplicado={() => {
          setModalVacuna(false)
          refetch()
        }}
      />
    </div>
  )
}

/** Cuanto cambio el promedio contra el muestreo anterior. */
function variacion(antes: number, ahora: number): string {
  if (antes === 0) return ahora === 0 ? 'Sin cambios' : `+${formatNumero(ahora)}`
  const pct = Math.round(((ahora - antes) / antes) * 100)
  if (pct === 0) return 'Sin cambios'
  return `${pct > 0 ? '+' : ''}${pct}%`
}

function Resumen({
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
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (destacado ? 'text-primary' : 'text-foreground')
        }
      >
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
    </div>
  )
}
