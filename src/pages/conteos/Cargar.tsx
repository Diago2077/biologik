import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Images,
  Loader2,
  RotateCcw,
  UploadCloud,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CapturaFoto } from '@/components/conteos/CapturaFoto'
import { RevisionConteoCard } from '@/components/conteos/RevisionConteoCard'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox } from '@/components/ui/estado'
import { useAnimal } from '@/hooks/useAnimales'
import { useAuth } from '@/hooks/useAuth'
import { useConteoAlta } from '@/hooks/useConteoAlta'
import {
  EXTENSIONES_PERMITIDAS,
  archivoDemasiadoGrande,
  prepararParaConteo,
  tipoPermitido,
} from '@/lib/archivos'
import { conteoIAAFormState, type ConteoFormState, type ConteoIA } from '@/lib/conteo'
import { cn } from '@/lib/utils'

type EstadoItem = 'pendiente' | 'contando' | 'listo' | 'error' | 'descartado' | 'guardando' | 'guardado'

interface ItemLote {
  id: string
  archivo: File
  previewSrc: string
  estado: EstadoItem
  error?: string
  form?: ConteoFormState
  raw?: ConteoIA
}

function idAleatorio() {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Cuantas fotos se cuentan a la vez. Secuencial se hacia muy largo, y subirlo
 * mucho tampoco conviene: las primeras llamadas de la tanda salen antes de
 * que OpenAI tenga cacheado el prefijo del prompt, asi que a mas paralelismo
 * mas veces se paga el prompt entero.
 */
const CONCURRENCIA = 3

/** Corre la tarea sobre todos los items, pero nunca mas de `limite` a la vez. */
async function enTandas<T>(items: T[], limite: number, tarea: (item: T) => Promise<void>) {
  let siguiente = 0
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (siguiente < items.length) {
      await tarea(items[siguiente++])
    }
  })
  await Promise.all(trabajadores)
}

export default function Cargar() {
  const { id: animalId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { puedeEditar } = useAuth()
  const { data: animal, loading: cargandoAnimal } = useAnimal(animalId)
  const { contar, guardar } = useConteoAlta()

  // Un lector no carga fotos: la RLS igual bloquearia el insert en `conteos`,
  // pero sin esto llegaria a ver el flujo entero de captura antes de fallar.
  useEffect(() => {
    if (!puedeEditar && animalId) navigate(`/animales/${animalId}`, { replace: true })
  }, [puedeEditar, animalId, navigate])

  const [items, setItems] = useState<ItemLote[]>([])
  const [procesando, setProcesando] = useState(false)
  const [guardandoTodo, setGuardandoTodo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const camaraRef = useRef<HTMLInputElement>(null)

  function actualizarItem(
    id: string,
    cambios: Partial<ItemLote> | ((item: ItemLote) => Partial<ItemLote>),
  ) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, ...(typeof cambios === 'function' ? cambios(it) : cambios) } : it,
      ),
    )
  }

  async function onArchivosSeleccionados(archivos: FileList | File[]) {
    if (!animalId) return
    const lista = Array.from(archivos)
    const validos = lista.filter(tipoPermitido)
    const grandes = validos.filter(archivoDemasiadoGrande)
    const utilizables = validos.filter((a) => !archivoDemasiadoGrande(a))

    if (lista.length !== validos.length) {
      toast.error('Algunos archivos no son JPG, PNG o WEBP y se omitieron.')
    }
    if (grandes.length > 0) {
      toast.error(
        `${grandes.length === 1 ? 'Una foto pesa' : `${grandes.length} fotos pesan`} más de 15 MB y se omitieron.`,
      )
    }
    if (utilizables.length === 0) return

    const nuevos: ItemLote[] = utilizables.map((archivo) => ({
      id: idAleatorio(),
      archivo,
      previewSrc: '',
      estado: 'pendiente',
    }))
    setItems((prev) => [...prev, ...nuevos])
    setProcesando(true)
    await enTandas(nuevos, CONCURRENCIA, procesarItem)
    setProcesando(false)
  }

  /** Prepara la foto y la manda a contar. Sirve igual para el reintento. */
  async function procesarItem(item: ItemLote) {
    if (!animalId) return
    actualizarItem(item.id, { estado: 'contando', error: undefined })
    try {
      const { base64, mime, previewDataUrl } = await prepararParaConteo(item.archivo)
      actualizarItem(item.id, { previewSrc: previewDataUrl })

      const { datos, error } = await contar(animalId, base64, mime)
      if (error || !datos) {
        actualizarItem(item.id, { estado: 'error', error: error ?? 'No se pudo contar la foto.' })
        return
      }
      actualizarItem(item.id, { estado: 'listo', form: conteoIAAFormState(datos), raw: datos })
    } catch {
      actualizarItem(item.id, { estado: 'error', error: 'No se pudo procesar la foto.' })
    }
  }

  /** La foto sigue en memoria, asi que reintentar no obliga a volver a elegirla. */
  async function onReintentar(item: ItemLote) {
    setProcesando(true)
    await procesarItem(item)
    setProcesando(false)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastrando(false)
    if (e.dataTransfer.files?.length) onArchivosSeleccionados(e.dataTransfer.files)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) onArchivosSeleccionados(e.target.files)
    e.target.value = ''
  }

  const listos = items.filter(
    (i) => i.estado === 'listo' || i.estado === 'guardando' || i.estado === 'guardado',
  )
  const conError = items.filter((i) => i.estado === 'error')
  const todoTerminado =
    !procesando && items.length > 0 && items.every((i) => i.estado !== 'pendiente' && i.estado !== 'contando')
  const guardables = items.filter((i) => i.estado === 'listo')
  const faltaZona = guardables.some((i) => !i.form?.lado_cuerpo)

  async function onGuardarTodo() {
    if (!animalId || !animal) return
    if (faltaZona) {
      toast.error('Elegí la zona del cuerpo en todas las fotos antes de guardar.')
      return
    }
    setGuardandoTodo(true)

    for (const item of items) {
      if (item.estado !== 'listo' || !item.form) continue
      actualizarItem(item.id, { estado: 'guardando' })
      const { error } = await guardar(animalId, animal.empresa_id, item.archivo, item.form, item.raw)
      if (error) {
        actualizarItem(item.id, { estado: 'error', error })
      } else {
        actualizarItem(item.id, { estado: 'guardado' })
      }
    }

    setGuardandoTodo(false)

    setItems((prev) => {
      const quedanErrores = prev.some((i) => i.estado === 'error')
      if (!quedanErrores) {
        toast.success('Conteos guardados')
        navigate(`/animales/${animalId}`)
      } else {
        toast.warning('Algunos conteos no se pudieron guardar. Revisalos abajo.')
      }
      return prev
    })
  }

  if (cargandoAnimal) return <Cargando />
  if (!animal) return <ErrorBox mensaje="No se encontró el animal." />

  return (
    <div>
      <Link
        to={`/animales/${animal.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Caravana {animal.caravana}
      </Link>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Cargar fotos</h1>
        <p className="text-sm text-muted-foreground">
          Sacá o subí una o varias fotos: la IA cuenta las garrapatas de cada una y después las
          revisás antes de guardar.
        </p>
      </div>

      {items.length === 0 && (
        <div className="space-y-4">
          <div className="sm:hidden">
            <CapturaFoto onArchivos={onArchivosSeleccionados} />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors',
              arrastrando
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-accent/40',
            )}
          >
            <UploadCloud className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Arrastrá las fotos acá o hacé click para elegirlas
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG o WEBP · hasta 15 MB cada una
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={EXTENSIONES_PERMITIDAS}
              className="hidden"
              onChange={onInputChange}
            />
          </div>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-foreground">
                {items.length} {items.length === 1 ? 'foto' : 'fotos'}
              </span>
              {listos.length > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-4" /> {listos.length} contadas
                </span>
              )}
              {conError.length > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-4" /> {conError.length} con error
                </span>
              )}
              {procesando && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Contando…
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => camaraRef.current?.click()}
                disabled={procesando}
                className="sm:hidden"
              >
                <Camera /> Cámara
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={procesando}
              >
                <Images className="sm:hidden" />
                <span className="hidden sm:inline">Agregar más</span>
                <span className="sm:hidden">Galería</span>
              </Button>
              <input
                ref={camaraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onInputChange}
              />
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={EXTENSIONES_PERMITIDAS}
                className="hidden"
                onChange={onInputChange}
              />
              {todoTerminado && guardables.length > 0 && (
                <Button size="sm" onClick={onGuardarTodo} disabled={guardandoTodo}>
                  {guardandoTodo
                    ? 'Guardando…'
                    : `Guardar ${guardables.length === 1 ? 'conteo' : `${guardables.length} conteos`}`}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {items.map((item) => (
              <ItemLoteRow
                key={item.id}
                item={item}
                onCambiar={(cambios) =>
                  actualizarItem(item.id, (it) => ({ form: { ...it.form!, ...cambios } }))
                }
                onDescartar={() => actualizarItem(item.id, { estado: 'descartado' })}
                onRestaurar={() => actualizarItem(item.id, { estado: 'listo' })}
                onReintentar={() => onReintentar(item)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ItemLoteRow({
  item,
  onCambiar,
  onDescartar,
  onRestaurar,
  onReintentar,
}: {
  item: ItemLote
  onCambiar: (cambios: Partial<ConteoFormState>) => void
  onDescartar: () => void
  onRestaurar: () => void
  onReintentar: () => void
}) {
  if (item.estado === 'pendiente' || item.estado === 'contando') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="truncate text-sm text-muted-foreground">{item.archivo.name}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">Contando con IA…</span>
      </div>
    )
  }

  if (item.estado === 'error') {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <span className="truncate text-sm font-medium text-foreground">{item.archivo.name}</span>
          <Button variant="ghost" size="sm" className="ml-auto shrink-0" onClick={onReintentar}>
            <RotateCcw /> Reintentar
          </Button>
        </div>
        <p className="mt-1 text-xs text-destructive">{item.error}</p>
      </div>
    )
  }

  if (item.estado === 'guardado') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
        <CheckCircle2 className="size-4 text-success" />
        <span className="truncate text-sm text-foreground">{item.archivo.name}</span>
        <span className="ml-auto shrink-0 text-xs text-success">Guardado</span>
      </div>
    )
  }

  if (item.estado === 'guardando') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="truncate text-sm text-muted-foreground">{item.archivo.name}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">Guardando…</span>
      </div>
    )
  }

  if (!item.form) return null

  return (
    <RevisionConteoCard
      nombreArchivo={item.archivo.name}
      previewSrc={item.previewSrc}
      form={item.form}
      crudo={item.raw?.count_crudo}
      descartada={item.estado === 'descartado'}
      onCambiar={onCambiar}
      onDescartar={onDescartar}
      onRestaurar={onRestaurar}
    />
  )
}
