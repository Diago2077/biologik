import { MapPin, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FincaFormModal } from '@/components/fincas/FincaFormModal'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Input } from '@/components/ui/field'
import { useAuth } from '@/hooks/useAuth'
import { useFincas } from '@/hooks/useFincas'
import type { Finca } from '@/lib/database.types'
import { normalizar } from '@/lib/format'

export default function Fincas() {
  const navigate = useNavigate()
  const { puedeEditar } = useAuth()
  const { data, loading, error, refetch } = useFincas()
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Finca | null>(null)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return data
    return data.filter(
      (f) => normalizar(f.nombre).includes(q) || normalizar(f.propietario ?? '').includes(q),
    )
  }, [data, busqueda])

  function abrirNueva() {
    setEnEdicion(null)
    setModalAbierto(true)
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fincas</h1>
          <p className="text-sm text-muted-foreground">
            Los establecimientos de la empresa. Desde cada uno se entra a sus animales.
          </p>
        </div>
        {puedeEditar && (
          <Button onClick={abrirNueva}>
            <Plus /> Nueva finca
          </Button>
        )}
      </div>

      {data.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o propietario…"
            className="pl-9"
            type="search"
          />
        </div>
      )}

      {error && <ErrorBox mensaje={error} />}
      {loading && <Cargando />}

      {!loading && !error && data.length === 0 && (
        <div className="rounded-lg border border-border bg-card">
          <Vacio
            icono={MapPin}
            titulo="Todavia no hay fincas"
            descripcion="Cargá la primera finca para empezar a registrar animales y sus conteos."
            accion={
              puedeEditar ? (
                <Button onClick={abrirNueva}>
                  <Plus /> Nueva finca
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Propietario</th>
                <th className="px-4 py-2.5 font-medium">Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtradas.map((finca) => (
                <tr
                  key={finca.id}
                  onClick={() => navigate(`/fincas/${finca.id}`)}
                  className="cursor-pointer select-none transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{finca.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{finca.propietario ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[finca.ubicacion, finca.ciudad].filter(Boolean).join(', ') || '—'}
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No se encontraron fincas con esa búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <FincaFormModal
        abierto={modalAbierto}
        finca={enEdicion}
        onCerrar={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false)
          refetch()
        }}
      />
    </div>
  )
}
