import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useBanos } from '@/hooks/useBanos'
import { hoyISO } from '@/lib/format'

/** Registra una jornada de baño acaricida sobre toda la finca. */
export function BanoFormModal({
  abierto,
  crear,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  crear: ReturnType<typeof useBanos>['crear']
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [fecha, setFecha] = useState(hoyISO())
  const [producto, setProducto] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setFecha(hoyISO())
    setProducto('')
    setObservaciones('')
    setError(null)
  }, [abierto])

  async function onGuardar() {
    setGuardando(true)
    setError(null)
    const { error: err } = await crear({ fecha, producto, observaciones })
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    toast.success('Baño registrado')
    onGuardado()
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Registrar baño acaricida"
      descripcion="El tratamiento de toda la finca en una jornada."
      onCerrar={onCerrar}
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Registrar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Fecha del baño">
          <Input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
            autoFocus
          />
        </Field>
        <Field
          label="Producto"
          hint="Anotarlo permite ver si se está repitiendo siempre el mismo, que es lo que genera resistencia."
        >
          <Input
            value={producto}
            onChange={(e) => setProducto(e.target.value)}
            placeholder="Amitraz, cipermetrina…"
          />
        </Field>
        <Field label="Observaciones">
          <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Modal>
  )
}
