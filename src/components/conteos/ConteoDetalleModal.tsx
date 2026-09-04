import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ImageLightbox } from '@/components/ui/image-lightbox'
import { Modal } from '@/components/ui/modal'
import { useConteos } from '@/hooks/useConteos'
import { LADOS_CUERPO, type Conteo, type LadoCuerpo } from '@/lib/database.types'
import { urlFirmada } from '@/lib/storage'

/**
 * Ficha de un conteo ya guardado: la foto y los datos, editables.
 *
 * El total se puede corregir despues de guardado a proposito: si al revisar
 * la foto en grande se ve que la IA conto de mas o de menos, el numero que
 * queda registrado tiene que poder arreglarse sin borrar y volver a cargar.
 */
export function ConteoDetalleModal({
  conteo,
  onCerrar,
  onGuardado,
}: {
  conteo: Conteo | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { actualizar } = useConteos(conteo?.animal_id)
  const [url, setUrl] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    lado_cuerpo: '' as LadoCuerpo | '',
    count_total: '',
    fecha_conteo: '',
    observaciones: '',
  })

  useEffect(() => {
    if (!conteo) return
    setForm({
      lado_cuerpo: conteo.lado_cuerpo,
      count_total: String(conteo.count_total),
      fecha_conteo: conteo.fecha_conteo,
      observaciones: conteo.observaciones ?? '',
    })
  }, [conteo])

  // El bucket es privado: la foto se muestra con una URL firmada de una hora,
  // que hay que pedir cada vez que se abre la ficha.
  useEffect(() => {
    let cancelado = false
    setUrl(null)
    if (!conteo?.archivo_path) return
    ;(async () => {
      const firmada = await urlFirmada(conteo.archivo_path as string)
      if (!cancelado) setUrl(firmada)
    })()
    return () => {
      cancelado = true
    }
  }, [conteo])

  async function onGuardar() {
    if (!conteo) return
    const n = Number(form.count_total)
    if (!Number.isInteger(n) || n < 0) {
      toast.error('El total tiene que ser un número entero de 0 o más.')
      return
    }

    setGuardando(true)
    const { error } = await actualizar(conteo.id, {
      lado_cuerpo: form.lado_cuerpo as LadoCuerpo,
      count_total: n,
      fecha_conteo: form.fecha_conteo,
      observaciones: form.observaciones.trim() || null,
    })
    setGuardando(false)

    if (error) {
      toast.error(error)
      return
    }
    toast.success('Conteo actualizado')
    onGuardado()
  }

  return (
    <>
      <Modal
        abierto={conteo !== null}
        titulo="Conteo"
        descripcion="Corregí el total si al ver la foto en grande no coincide."
        onCerrar={onCerrar}
        ancho="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={onCerrar} disabled={guardando}>
              Cerrar
            </Button>
            <Button onClick={onGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            {url ? (
              <button
                type="button"
                onClick={() => setLightbox(true)}
                className="block w-full overflow-hidden rounded-lg border border-border"
              >
                <img src={url} alt="Foto del conteo" className="w-full object-cover" />
              </button>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                {conteo?.archivo_path ? 'Cargando foto…' : 'Sin foto'}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Field label="Zona del cuerpo">
              <Select
                value={form.lado_cuerpo}
                onChange={(e) => setForm((f) => ({ ...f, lado_cuerpo: e.target.value as LadoCuerpo }))}
              >
                {LADOS_CUERPO.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Total de garrapatas">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={form.count_total}
                onChange={(e) => setForm((f) => ({ ...f, count_total: e.target.value }))}
              />
            </Field>

            <Field label="Fecha">
              <Input
                type="date"
                value={form.fecha_conteo}
                onChange={(e) => setForm((f) => ({ ...f, fecha_conteo: e.target.value }))}
              />
            </Field>

            <Field label="Observaciones">
              <Textarea
                value={form.observaciones}
                onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <ImageLightbox
        src={url}
        alt="Foto del conteo"
        abierto={lightbox}
        onCerrar={() => setLightbox(false)}
      />
    </>
  )
}
