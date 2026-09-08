import { Building2, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useEmpresas } from '@/hooks/useEmpresas'
import { formatRuc, normalizar } from '@/lib/format'
import { UMBRAL_POR_DEFECTO } from '@/lib/umbral'
import { PLAN_POR_DEFECTO } from '@/lib/vacunacion'
import type { EmpresaInsert } from '@/lib/database.types'

const EMPRESA_VACIA: EmpresaInsert = {
  nombre: '',
  ruc: '',
  email: '',
  telefono: '',
  direccion: '',
  logo_url: null,
  activo: true,
  // Los defaults de la base; se cambian desde la ficha de la empresa.
  modo_cronograma_vacunacion: 'reajustar',
  umbral_garrapatas: UMBRAL_POR_DEFECTO,
  dias_segunda_dosis: PLAN_POR_DEFECTO.diasSegundaDosis,
  dias_refuerzo: PLAN_POR_DEFECTO.diasRefuerzo,
  dias_aviso_vacunacion: PLAN_POR_DEFECTO.diasAviso,
  limite_tokens_mensual: null,
}

export default function Empresas() {
  const { data: empresas, loading, error, refetch, crear } = useEmpresas()
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState<EmpresaInsert>(EMPRESA_VACIA)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return empresas
    return empresas.filter(
      (e) => normalizar(e.nombre).includes(q) || normalizar(e.ruc ?? '').includes(q),
    )
  }, [empresas, busqueda])

  function abrirNuevo() {
    setForm(EMPRESA_VACIA)
    setErrorForm(null)
    setModalAbierto(true)
  }

  async function onGuardar() {
    if (!form.nombre.trim()) {
      setErrorForm('El nombre de la empresa es obligatorio.')
      return
    }
    setGuardando(true)
    setErrorForm(null)
    const { error: err } = await crear({
      ...form,
      nombre: form.nombre.trim(),
      ruc: form.ruc?.trim() || null,
      email: form.email?.trim() || null,
      telefono: form.telefono?.trim() || null,
      direccion: form.direccion?.trim() || null,
    })
    setGuardando(false)
    if (err) {
      setErrorForm(err)
      return
    }
    setModalAbierto(false)
    refetch()
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            Cada empresa es un espacio totalmente aislado del resto.
          </p>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus /> Nueva empresa
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre o RUC…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {loading ? (
        <Cargando />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : filtradas.length === 0 ? (
        <Vacio
          icono={Building2}
          titulo={busqueda ? 'Sin resultados' : 'Todavia no hay empresas'}
          descripcion={busqueda ? 'Probá con otra busqueda.' : 'Crea el primer empresa para empezar.'}
          accion={
            !busqueda && (
              <Button onClick={abrirNuevo}>
                <Plus /> Nueva empresa
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Empresa</th>
                <th className="px-4 py-2.5 font-medium">RUC</th>
                <th className="px-4 py-2.5 font-medium">Contacto</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => navigate(`/admindrpcs/${e.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">{e.nombre}</td>
                  <td className="px-4 py-2.5 tabular text-muted-foreground">{formatRuc(e.ruc)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.email || '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge tono={e.activo ? 'success' : 'neutral'}>
                      {e.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        abierto={modalAbierto}
        titulo="Nuevo empresa"
        onCerrar={() => setModalAbierto(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalAbierto(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={onGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Crear empresa'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre de la empresa *">
            <Input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              autoFocus
            />
          </Field>
          <Field label="RUC">
            <Input
              value={form.ruc ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, ruc: e.target.value }))}
              placeholder="80012345-6"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Telefono">
              <Input
                value={form.telefono ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Direccion">
            <Textarea
              value={form.direccion ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
              rows={2}
            />
          </Field>
          {errorForm && <ErrorBox mensaje={errorForm} />}
        </div>
      </Modal>
    </div>
  )
}
