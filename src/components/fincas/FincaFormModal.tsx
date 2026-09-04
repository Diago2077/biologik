import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/hooks/useAuth'
import { useFincas } from '@/hooks/useFincas'
import type { Finca } from '@/lib/database.types'

interface FormState {
  nombre: string
  propietario: string
  ubicacion: string
  ciudad: string
  telefono: string
  email: string
}

const VACIO: FormState = { nombre: '', propietario: '', ubicacion: '', ciudad: '', telefono: '', email: '' }

function desdeFinca(finca: Finca): FormState {
  return {
    nombre: finca.nombre,
    propietario: finca.propietario ?? '',
    ubicacion: finca.ubicacion ?? '',
    ciudad: finca.ciudad ?? '',
    telefono: finca.telefono ?? '',
    email: finca.email ?? '',
  }
}

export function FincaFormModal({
  abierto,
  finca,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  /** null = alta; una finca = edicion. */
  finca: Finca | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { empresa } = useAuth()
  const { crear, actualizar } = useFincas()
  const [form, setForm] = useState<FormState>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Al reabrir el modal el formulario tiene que reflejar la finca actual
  // (o quedar limpio si es un alta), no lo que hubiera quedado de la vez
  // anterior.
  useEffect(() => {
    if (!abierto) return
    setForm(finca ? desdeFinca(finca) : VACIO)
    setError(null)
  }, [abierto, finca])

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nombre = form.nombre.trim()
    if (!nombre) {
      setError('El nombre de la finca es obligatorio.')
      return
    }
    if (!empresa) {
      setError('Tu usuario no tiene una empresa asignada.')
      return
    }

    setGuardando(true)
    setError(null)

    const payload = {
      empresa_id: empresa.id,
      nombre,
      propietario: form.propietario.trim() || null,
      ubicacion: form.ubicacion.trim() || null,
      ciudad: form.ciudad.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      activo: true,
    }

    const { error: err } = finca ? await actualizar(finca.id, payload) : await crear(payload)
    setGuardando(false)

    if (err) {
      setError(err)
      return
    }
    toast.success(finca ? 'Finca actualizada' : 'Finca creada')
    onGuardado()
  }

  return (
    <Modal
      abierto={abierto}
      titulo={finca ? 'Editar finca' : 'Nueva finca'}
      onCerrar={onCerrar}
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button form="form-finca" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-finca" onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre">
          <Input
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            placeholder="El Retorno"
            autoFocus
          />
        </Field>

        <Field label="Propietario">
          <Input
            value={form.propietario}
            onChange={(e) => set('propietario', e.target.value)}
            placeholder="Nombre del propietario"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ubicación">
            <Input
              value={form.ubicacion}
              onChange={(e) => set('ubicacion', e.target.value)}
              placeholder="Ruta, km, referencia"
            />
          </Field>
          <Field label="Ciudad">
            <Input value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </Modal>
  )
}
