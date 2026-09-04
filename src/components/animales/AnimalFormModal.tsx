import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useAnimales } from '@/hooks/useAnimales'
import { useAuth } from '@/hooks/useAuth'
import { CATEGORIAS_ANIMAL, type Animal } from '@/lib/database.types'

interface FormState {
  caravana: string
  categoria: string
  raza: string
  observaciones: string
}

const VACIO: FormState = { caravana: '', categoria: '', raza: '', observaciones: '' }

function desdeAnimal(animal: Animal): FormState {
  return {
    caravana: animal.caravana,
    categoria: animal.categoria ?? '',
    raza: animal.raza ?? '',
    observaciones: animal.observaciones ?? '',
  }
}

export function AnimalFormModal({
  abierto,
  fincaId,
  animal,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  fincaId: string
  /** null = alta; un animal = edicion. */
  animal: Animal | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { empresa } = useAuth()
  const { crear, actualizar } = useAnimales(fincaId)
  const [form, setForm] = useState<FormState>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setForm(animal ? desdeAnimal(animal) : VACIO)
    setError(null)
  }, [abierto, animal])

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const caravana = form.caravana.trim()
    if (!caravana) {
      setError('El número de caravana es obligatorio.')
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
      finca_id: fincaId,
      caravana,
      categoria: form.categoria || null,
      raza: form.raza.trim() || null,
      observaciones: form.observaciones.trim() || null,
      activo: true,
    }

    const { error: err } = animal ? await actualizar(animal.id, payload) : await crear(payload)
    setGuardando(false)

    if (err) {
      setError(err)
      return
    }
    toast.success(animal ? 'Animal actualizado' : 'Animal creado')
    onGuardado()
  }

  return (
    <Modal
      abierto={abierto}
      titulo={animal ? 'Editar animal' : 'Nuevo animal'}
      onCerrar={onCerrar}
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button form="form-animal" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-animal" onSubmit={onSubmit} className="space-y-4">
        <Field label="Número de caravana">
          <Input
            value={form.caravana}
            onChange={(e) => set('caravana', e.target.value)}
            placeholder="47"
            autoFocus
            inputMode="numeric"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría">
            <Select value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
              <option value="">Sin especificar</option>
              {CATEGORIAS_ANIMAL.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Raza">
            <Input
              value={form.raza}
              onChange={(e) => set('raza', e.target.value)}
              placeholder="Brangus"
            />
          </Field>
        </div>

        <Field label="Observaciones">
          <Textarea
            value={form.observaciones}
            onChange={(e) => set('observaciones', e.target.value)}
            placeholder="Notas sobre el animal"
          />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </Modal>
  )
}
