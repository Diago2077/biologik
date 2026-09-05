import { ArrowLeft, Camera, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimalFormModal } from '@/components/animales/AnimalFormModal'
import { ConteoDetalleModal } from '@/components/conteos/ConteoDetalleModal'
import { VacunacionAnimal } from '@/components/vacunaciones/VacunacionAnimal'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Modal } from '@/components/ui/modal'
import { useAnimal } from '@/hooks/useAnimales'
import { useConteos } from '@/hooks/useConteos'
import { useFinca } from '@/hooks/useFincas'
import { ladoLabel, type Conteo } from '@/lib/database.types'
import { formatFecha, formatNumero } from '@/lib/format'

export default function AnimalDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: animal, loading: cargandoAnimal } = useAnimal(id)
  const { data: finca } = useFinca(animal?.finca_id)
  const { data: conteos, loading, error, refetch, eliminar } = useConteos(id)

  const [modalAnimal, setModalAnimal] = useState(false)
  const [verConteo, setVerConteo] = useState<Conteo | null>(null)
  const [aEliminar, setAEliminar] = useState<Conteo | null>(null)
  const [eliminando, setEliminando] = useState(false)

  /**
   * Los conteos se agrupan por fecha: la carga del animal es lo que se le
   * conto en UN dia sumando todas sus zonas. El acumulado historico no
   * sirve como indicador -- solo crece con cada visita.
   */
  const muestreos = useMemo(() => {
    const porFecha = new Map<string, number>()
    for (const c of conteos) {
      porFecha.set(c.fecha_conteo, (porFecha.get(c.fecha_conteo) ?? 0) + c.count_total)
    }
    return [...porFecha.entries()]
      .map(([fecha, carga]) => ({ fecha, carga }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [conteos])

  const ultimaCarga = muestreos[0]?.carga ?? null
  const promedioCarga = muestreos.length
    ? Math.round(muestreos.reduce((s, m) => s + m.carga, 0) / muestreos.length)
    : null

  async function confirmarEliminar() {
    if (!aEliminar) return
    setEliminando(true)
    const { error: err } = await eliminar(aEliminar)
    setEliminando(false)
    if (err) {
      toast.error(err)
      return
    }
    toast.success('Conteo eliminado')
    setAEliminar(null)
  }

  if (cargandoAnimal) return <Cargando />
  if (!animal) return <ErrorBox mensaje="No se encontró el animal." />

  return (
    <div>
      <Link
        to={`/fincas/${animal.finca_id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {finca?.nombre ?? 'Volver'}
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">Caravana {animal.caravana}</h1>
          <p className="text-sm text-muted-foreground">
            {[animal.categoria, animal.raza].filter(Boolean).join(' · ') || 'Sin categoría ni raza'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModalAnimal(true)}>
            <Pencil /> Editar
          </Button>
          <Button onClick={() => navigate(`/animales/${animal.id}/cargar`)}>
            <Camera /> Cargar fotos
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Resumen
          etiqueta="Última carga"
          valor={ultimaCarga !== null ? formatNumero(ultimaCarga) : '—'}
          nota={muestreos[0] ? formatFecha(muestreos[0].fecha) : 'Todavía sin conteos'}
          destacado
        />
        <Resumen
          etiqueta="Promedio por muestreo"
          valor={promedioCarga !== null ? formatNumero(promedioCarga) : '—'}
          nota={`${muestreos.length} ${muestreos.length === 1 ? 'muestreo' : 'muestreos'}`}
        />
        <Resumen etiqueta="Fotos contadas" valor={formatNumero(conteos.length)} />
      </div>

      <div className="mb-5">
        <VacunacionAnimal animalId={animal.id} />
      </div>

      {error && <ErrorBox mensaje={error} />}
      {loading && <Cargando />}

      {!loading && !error && conteos.length === 0 && (
        <div className="rounded-lg border border-border bg-card">
          <Vacio
            icono={Camera}
            titulo="Todavía no hay conteos"
            descripcion="Sacá o subí fotos de las zonas del cuerpo del animal: la IA cuenta las garrapatas y vos revisás el resultado antes de guardar."
            accion={
              <Button onClick={() => navigate(`/animales/${animal.id}/cargar`)}>
                <Camera /> Cargar fotos
              </Button>
            }
          />
        </div>
      )}

      {!loading && !error && conteos.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Zona</th>
                <th className="px-4 py-2.5 text-right font-medium">Garrapatas</th>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Observaciones</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {conteos.map((conteo) => (
                <tr
                  key={conteo.id}
                  onClick={() => setVerConteo(conteo)}
                  className="cursor-pointer select-none transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {ladoLabel(conteo.lado_cuerpo)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                    {formatNumero(conteo.count_total)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatFecha(conteo.fecha_conteo)}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                    {conteo.observaciones ?? '—'}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar conteo"
                      onClick={(e) => {
                        e.stopPropagation()
                        setAEliminar(conteo)
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimalFormModal
        abierto={modalAnimal}
        fincaId={animal.finca_id}
        animal={animal}
        onCerrar={() => setModalAnimal(false)}
        onGuardado={() => {
          setModalAnimal(false)
          window.location.reload()
        }}
      />

      <ConteoDetalleModal
        conteo={verConteo}
        onCerrar={() => setVerConteo(null)}
        onGuardado={() => {
          setVerConteo(null)
          refetch()
        }}
      />

      <Modal
        abierto={aEliminar !== null}
        titulo="Eliminar conteo"
        onCerrar={() => setAEliminar(null)}
        ancho="max-w-sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAEliminar(null)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminar} disabled={eliminando}>
              {eliminando ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Se va a borrar el conteo de{' '}
          <span className="font-medium text-foreground">
            {aEliminar ? ladoLabel(aEliminar.lado_cuerpo) : ''}
          </span>{' '}
          ({aEliminar?.count_total} garrapatas) junto con su foto. Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
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
