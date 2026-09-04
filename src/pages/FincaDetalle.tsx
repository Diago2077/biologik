import { ArrowLeft, Beef, Pencil, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimalFormModal } from '@/components/animales/AnimalFormModal'
import { FincaFormModal } from '@/components/fincas/FincaFormModal'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Input } from '@/components/ui/field'
import { useAnimales } from '@/hooks/useAnimales'
import { useFinca } from '@/hooks/useFincas'
import { formatFecha, formatNumero, normalizar } from '@/lib/format'

export default function FincaDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: finca, loading: cargandoFinca, refetch: refetchFinca } = useFinca(id)
  const { data: animales, loading, error, refetch } = useAnimales(id)

  const [busqueda, setBusqueda] = useState('')
  const [modalAnimal, setModalAnimal] = useState(false)
  const [modalFinca, setModalFinca] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return animales
    return animales.filter((a) => normalizar(a.caravana).includes(q))
  }, [animales, busqueda])

  const totalGeneral = useMemo(
    () => animales.reduce((suma, a) => suma + a.total_garrapatas, 0),
    [animales],
  )

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModalFinca(true)}>
            <Pencil /> Editar finca
          </Button>
          <Button onClick={() => setModalAnimal(true)}>
            <Plus /> Nuevo animal
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Resumen etiqueta="Animales" valor={formatNumero(animales.length)} />
        <Resumen etiqueta="Garrapatas contadas" valor={formatNumero(totalGeneral)} destacado />
        <Resumen
          etiqueta="Promedio por animal"
          valor={animales.length ? formatNumero(Math.round(totalGeneral / animales.length)) : '—'}
        />
      </div>

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
            descripcion="Cargá el primer animal con su número de caravana para poder registrarle conteos."
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
                <th className="px-4 py-2.5 font-medium">Categoría</th>
                <th className="px-4 py-2.5 text-right font-medium">Garrapatas</th>
                <th className="px-4 py-2.5 text-right font-medium">Conteos</th>
                <th className="px-4 py-2.5 font-medium">Último</th>
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
                  <td className="px-4 py-3 text-muted-foreground">{animal.categoria ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                    {formatNumero(animal.total_garrapatas)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {animal.cantidad_conteos}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {animal.ultimo_conteo ? formatFecha(animal.ultimo_conteo) : '—'}
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
    </div>
  )
}

function Resumen({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string
  valor: string
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
    </div>
  )
}
