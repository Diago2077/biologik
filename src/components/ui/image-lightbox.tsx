import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const ESCALA_MIN = 1
const ESCALA_MAX = 6

/**
 * Visor de imagen a pantalla completa, tipo Google Drive: rueda del mouse
 * para zoom, arrastrar para desplazar una vez ampliada. Se monta con un
 * portal para no heredar overflow/z-index de donde se lo invoque.
 */
export function ImageLightbox({
  src,
  alt = '',
  abierto,
  onCerrar,
}: {
  src: string | null
  alt?: string
  abierto: boolean
  onCerrar: () => void
}) {
  const [escala, setEscala] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const arrastrando = useRef(false)
  const ultimoPunto = useRef({ x: 0, y: 0 })

  // Reiniciar zoom/posicion cada vez que se abre (o cambia de archivo)
  useEffect(() => {
    if (abierto) {
      setEscala(1)
      setPos({ x: 0, y: 0 })
    }
  }, [abierto, src])

  useEffect(() => {
    if (!abierto) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', onKey)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto, onCerrar])

  if (!abierto || !src) return null

  function aplicarZoom(delta: number) {
    setEscala((s) => {
      const nueva = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, s + delta))
      if (nueva === ESCALA_MIN) setPos({ x: 0, y: 0 })
      return nueva
    })
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    aplicarZoom(-e.deltaY * 0.0018 * escala)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (escala <= ESCALA_MIN) return
    arrastrando.current = true
    ultimoPunto.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!arrastrando.current) return
    const dx = e.clientX - ultimoPunto.current.x
    const dy = e.clientY - ultimoPunto.current.y
    ultimoPunto.current = { x: e.clientX, y: e.clientY }
    setPos((p) => ({ x: p.x + dx, y: p.y + dy }))
  }

  function onPointerUp() {
    arrastrando.current = false
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/90"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
      onWheel={onWheel}
    >
      <div className="absolute right-4 top-4 flex gap-2">
        <button
          onClick={() => aplicarZoom(-0.6)}
          className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          title="Alejar"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          onClick={() => aplicarZoom(0.6)}
          className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          title="Acercar"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          onClick={onCerrar}
          className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          title="Cerrar"
        >
          <X className="size-4" />
        </button>
      </div>

      {escala > ESCALA_MIN && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
          Arrastrá para mover · rueda para zoom
        </p>
      )}

      <img
        src={src}
        alt={alt}
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`,
          cursor: escala > ESCALA_MIN ? (arrastrando.current ? 'grabbing' : 'grab') : 'default',
        }}
        className="max-h-[92vh] max-w-[92vw] touch-none select-none object-contain"
      />
    </div>,
    document.body,
  )
}
