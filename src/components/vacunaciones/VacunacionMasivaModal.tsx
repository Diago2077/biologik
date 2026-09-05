import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useVacunacionMasiva } from '@/hooks/useVacunaciones'
import type { AnimalConResumen } from '@/lib/database.types'
import { hoyISO } from '@/lib/format'

/** Hasta que dosis se ofrece en el desplegable. */
const MAX_DOSIS = 8

/**
 * Registra una jornada de vacunacion sobre varios animales de la finca.
 *
 * Por defecto vienen marcados los animales a los que les toca esa dosis
 * (los que ya la tienen quedan desmarcados): en un lote de doscientos, que
 * la app proponga a quien corresponde evita tener que tildarlos a mano.
 */
export function VacunacionMasivaModal({
  abierto,
  animales,
  onCerrar,
  onAplicado,
}: {
  abierto: boolean
  animales: AnimalConResumen[]
  onCerrar: () => void
  onAplicado: () => void
}) {
  const { aplicar, guardando } = useVacunacionMasiva()
  const [numeroDosis, setNumeroDosis] = useState(1)
  const [fechaAplicada, setFechaAplicada] = useState(hoyISO())
  const [producto, setProducto] = useState('')
  const [lote, setLote] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  // La dosis que se propone es la mas chica que le falte a alguien: es la
  // que casi siempre se va a estar aplicando.
  const dosisSugerida = useMemo(() => {
    if (animales.length === 0) return 1
    return Math.min(...animales.map((a) => a.cronograma.proximaDosis))
  }, [animales])

  const yaTienenLaDosis = useMemo(
    () => new Set(animales.filter((a) => a.cronograma.ultimaDosis >= numeroDosis).map((a) => a.id)),
    [animales, numeroDosis],
  )

  useEffect(() => {
    if (!abierto) return
    setNumeroDosis(dosisSugerida)
    setFechaAplicada(hoyISO())
    setProducto('')
    setLote('')
    setObservaciones('')
  }, [abierto, dosisSugerida])

  // Al abrir, y cada vez que cambia la dosis elegida, se remarcan los que
  // corresponden.
  useEffect(() => {
    if (!abierto) return
    setSeleccion(new Set(animales.filter((a) => !yaTienenLaDosis.has(a.id)).map((a) => a.id)))
  }, [abierto, animales, yaTienenLaDosis])

  function alternar(id: string) {
    setSeleccion((prev) => {
      const copia = new Set(prev)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })
  }

  async function onAplicar() {
    const { error, aplicadas } = await aplicar({
      animalIds: [...seleccion],
      numeroDosis,
      fechaAplicada,
      producto,
      lote,
      observaciones,
    })
    if (error) {
      toast.error(error)
      return
    }
    toast.success(`${aplicadas} ${aplicadas === 1 ? 'animal vacunado' : 'animales vacunados'}`)
    onAplicado()
  }

  const reaplicaciones = [...seleccion].filter((id) => yaTienenLaDosis.has(id)).length

  return (
    <Modal
      abierto={abierto}
      titulo="Registrar vacunación"
      descripcion="Una jornada de vacunación sobre los animales que elijas."
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onAplicar} disabled={guardando || seleccion.size === 0}>
            {guardando ? 'Guardando…' : `Aplicar a ${seleccion.size}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dosis">
            <Select value={numeroDosis} onChange={(e) => setNumeroDosis(Number(e.target.value))}>
              {Array.from({ length: MAX_DOSIS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? '1ra dosis' : `${n}ª dosis`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha de aplicación">
            <Input
              type="date"
              value={fechaAplicada}
              max={hoyISO()}
              onChange={(e) => setFechaAplicada(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Producto">
            <Input value={producto} onChange={(e) => setProducto(e.target.value)} placeholder="Gavac" />
          </Field>
          <Field label="Lote del producto">
            <Input value={lote} onChange={(e) => setLote(e.target.value)} />
          </Field>
        </div>

        <Field label="Observaciones">
          <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Animales ({seleccion.size} de {animales.length})
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSeleccion(new Set(animales.map((a) => a.id)))}
              >
                Todos
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSeleccion(new Set())}>
                Ninguno
              </Button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            {animales.map((a) => {
              const laTiene = yaTienenLaDosis.has(a.id)
              return (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-accent/40"
                >
                  <input
                    type="checkbox"
                    checked={seleccion.has(a.id)}
                    onChange={() => alternar(a.id)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="text-sm font-medium text-foreground">{a.caravana}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {laTiene
                      ? `ya tiene la ${numeroDosis}ª`
                      : a.cronograma.ultimaDosis === 0
                        ? 'sin vacunar'
                        : `última: ${a.cronograma.ultimaDosis}ª`}
                  </span>
                </label>
              )
            })}
            {animales.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Esta finca todavía no tiene animales.
              </p>
            )}
          </div>

          {reaplicaciones > 0 && (
            <p className="mt-2 text-xs text-warning">
              {reaplicaciones}{' '}
              {reaplicaciones === 1
                ? 'animal seleccionado ya tenía esta dosis: se le va a pisar la fecha anterior.'
                : 'animales seleccionados ya tenían esta dosis: se les va a pisar la fecha anterior.'}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
