import { RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ImageLightbox } from '@/components/ui/image-lightbox'
import type { ConteoFormState } from '@/lib/conteo'
import { LADOS_CUERPO, type LadoCuerpo } from '@/lib/database.types'
import { cn } from '@/lib/utils'

/**
 * Una foto ya contada, lista para revisar antes de guardar.
 *
 * Se muestra el numero crudo del modelo al lado del calibrado cuando
 * difieren: sirve para entender de donde salio el numero propuesto y para ir
 * afinando la calibracion comparando contra conteos manuales.
 */
export function RevisionConteoCard({
  nombreArchivo,
  previewSrc,
  form,
  crudo,
  descartada,
  onCambiar,
  onDescartar,
  onRestaurar,
}: {
  nombreArchivo: string
  previewSrc: string
  form: ConteoFormState
  crudo?: number
  descartada: boolean
  onCambiar: (cambios: Partial<ConteoFormState>) => void
  onDescartar: () => void
  onRestaurar: () => void
}) {
  const [lightbox, setLightbox] = useState(false)
  const calibrado = Number(form.count_total)
  const muestraCrudo = crudo !== undefined && crudo !== calibrado

  return (
    <>
      <div
        className={cn(
          'rounded-lg border bg-card transition-opacity',
          descartada ? 'border-border opacity-55' : 'border-border',
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <span className="truncate text-xs text-muted-foreground">{nombreArchivo}</span>
          {descartada ? (
            <Button variant="ghost" size="sm" className="ml-auto shrink-0" onClick={onRestaurar}>
              <RotateCcw /> Restaurar
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onDescartar}
            >
              <Trash2 /> Descartar
            </Button>
          )}
        </div>

        <div className="grid gap-5 p-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="block overflow-hidden rounded-md border border-border"
          >
            <img src={previewSrc} alt={nombreArchivo} className="w-full object-cover" />
          </button>

          <div className="space-y-4">
            <Field
              label="Zona del cuerpo"
              hint={form.lado_cuerpo ? undefined : 'Elegí la zona antes de guardar.'}
            >
              <Select
                value={form.lado_cuerpo}
                disabled={descartada}
                onChange={(e) => onCambiar({ lado_cuerpo: e.target.value as LadoCuerpo })}
              >
                <option value="">Elegir zona…</option>
                {LADOS_CUERPO.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Total de garrapatas"
              hint={muestraCrudo ? `La IA contó ${crudo} y la calibración lo ajustó a ${calibrado}.` : undefined}
            >
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={form.count_total}
                disabled={descartada}
                onChange={(e) => onCambiar({ count_total: e.target.value })}
              />
            </Field>

            <Field label="Fecha">
              <Input
                type="date"
                value={form.fecha_conteo}
                disabled={descartada}
                onChange={(e) => onCambiar({ fecha_conteo: e.target.value })}
              />
            </Field>

            <Field label="Observaciones">
              <Textarea
                value={form.observaciones}
                disabled={descartada}
                onChange={(e) => onCambiar({ observaciones: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>

      <ImageLightbox
        src={previewSrc}
        alt={nombreArchivo}
        abierto={lightbox}
        onCerrar={() => setLightbox(false)}
      />
    </>
  )
}
