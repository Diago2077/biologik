import { Camera, Images } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { EXTENSIONES_PERMITIDAS } from '@/lib/archivos'

/**
 * Dos botones separados: uno abre la camara y el otro la galeria.
 *
 * La diferencia es el atributo `capture`: con capture="environment" el
 * navegador del celular abre directo la camara trasera; sin el, abre el
 * selector de fotos. Un solo input no puede hacer las dos cosas, por eso son
 * dos inputs ocultos y no uno con dos botones apuntando al mismo.
 */
export function CapturaFoto({
  onArchivos,
  disabled,
}: {
  onArchivos: (archivos: FileList | File[]) => void
  disabled?: boolean
}) {
  const camaraRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) onArchivos(e.target.files)
    // Permite volver a elegir el mismo archivo despues de descartarlo
    e.target.value = ''
  }

  return (
    <div className="flex gap-2">
      <input
        ref={camaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />
      <input
        ref={galeriaRef}
        type="file"
        accept={EXTENSIONES_PERMITIDAS}
        multiple
        className="hidden"
        onChange={onChange}
      />

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => camaraRef.current?.click()}
        aria-label="Tomar foto con la cámara"
        className="flex-1 sm:flex-none"
      >
        <Camera /> Cámara
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => galeriaRef.current?.click()}
        aria-label="Elegir fotos de la galería"
        className="flex-1 sm:flex-none"
      >
        <Images /> Galería
      </Button>
    </div>
  )
}
