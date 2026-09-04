import { ArrowLeft, Pencil, Plus, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConsumoIA } from '@/components/admin/ConsumoIA'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Field, Input, Textarea } from '@/components/ui/field'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import {
  CambiarPasswordModal,
  EditarUsuarioModal,
  NuevoUsuarioModal,
  UsuarioDetalleModal,
} from '@/components/usuarios/UsuarioModales'
import { useEmpresas } from '@/hooks/useEmpresas'
import { useUsuarios } from '@/hooks/useUsuarios'
import { ROL_LABEL, type Empresa, type EmpresaUpdate, type Usuario } from '@/lib/database.types'
import { formatFecha, formatRuc } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function EmpresaDetalle() {
  const { id } = useParams<{ id: string }>()
  const { actualizar: actualizarEmpresa } = useEmpresas()
  const {
    data: usuarios,
    loading: cargandoUsuarios,
    error: errorUsuarios,
    refetch: refetchUsuarios,
    crear,
    editar,
    eliminar,
    cambiarPassword,
    setActivo,
  } = useUsuarios(id)

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [cargandoEmpresa, setCargandoEmpresa] = useState(true)

  const [modalUsuario, setModalUsuario] = useState(false)
  const [modalDetalleUsuario, setModalDetalleUsuario] = useState<Usuario | null>(null)
  const [modalEditarUsuario, setModalEditarUsuario] = useState<Usuario | null>(null)
  const [modalPassword, setModalPassword] = useState<Usuario | null>(null)
  const [modalEliminar, setModalEliminar] = useState<Usuario | null>(null)
  const [modalEditarEmpresa, setModalEditarEmpresa] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelado = false
    setCargandoEmpresa(true)
    supabase
      .from('empresas')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) {
          setEmpresa((data as Empresa) ?? null)
          setCargandoEmpresa(false)
        }
      })
    return () => {
      cancelado = true
    }
  }, [id])

  async function alternarActivoEmpresa() {
    if (!empresa) return
    const { error } = await actualizarEmpresa(empresa.id, { activo: !empresa.activo })
    if (error) {
      toast.error('No se pudo actualizar la empresa.')
      return
    }
    setEmpresa({ ...empresa, activo: !empresa.activo })
    toast.success(empresa.activo ? 'Empresa desactivada' : 'Empresa activada')
  }

  if (cargandoEmpresa) return <Cargando />
  if (!empresa) return <ErrorBox mensaje="No se encontro la empresa." />

  return (
    <div>
      <Link
        to="/admindrpcs"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Empresas
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">{empresa.nombre}</h1>
            <Badge tono={empresa.activo ? 'success' : 'neutral'}>
              {empresa.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            RUC {formatRuc(empresa.ruc)} · Creado {formatFecha(empresa.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModalEditarEmpresa(true)}>
            <Pencil /> Editar
          </Button>
          <Button variant="outline" onClick={alternarActivoEmpresa}>
            {empresa.activo ? 'Desactivar empresa' : 'Activar empresa'}
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <ConsumoIA
          empresaId={empresa.id}
          limiteTokensMensual={empresa.limite_tokens_mensual}
          onCambiarLimite={async (limite) => {
            const { error: err } = await actualizarEmpresa(empresa.id, { limite_tokens_mensual: limite })
            if (!err) setEmpresa({ ...empresa, limite_tokens_mensual: limite })
            return { error: err }
          }}
        />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Usuarios</h2>
        <Button size="sm" onClick={() => setModalUsuario(true)}>
          <Plus /> Nuevo usuario
        </Button>
      </div>

      {cargandoUsuarios ? (
        <Cargando />
      ) : errorUsuarios ? (
        <ErrorBox mensaje={errorUsuarios} />
      ) : usuarios.length === 0 ? (
        <Vacio
          icono={UserRound}
          titulo="Esta empresa no tiene usuarios"
          descripcion="Crea el primer usuario para que puedan entrar a la app."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setModalDetalleUsuario(u)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">{u.nombre}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{ROL_LABEL[u.rol]}</td>
                  <td className="px-4 py-2.5">
                    <Badge tono={u.activo ? 'success' : 'neutral'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditarEmpresaModal
        abierto={modalEditarEmpresa}
        empresa={empresa}
        onCerrar={() => setModalEditarEmpresa(false)}
        onGuardado={(cambios) => {
          setEmpresa({ ...empresa, ...cambios })
          setModalEditarEmpresa(false)
        }}
        actualizar={actualizarEmpresa}
      />

      <NuevoUsuarioModal
        abierto={modalUsuario}
        empresaId={empresa.id}
        permiteElegirRol
        onCerrar={() => setModalUsuario(false)}
        onCreado={() => {
          setModalUsuario(false)
          refetchUsuarios()
        }}
        crear={crear}
      />

      <UsuarioDetalleModal
        usuario={modalDetalleUsuario}
        onCerrar={() => setModalDetalleUsuario(null)}
        onEditar={() => {
          setModalEditarUsuario(modalDetalleUsuario)
          setModalDetalleUsuario(null)
        }}
        onCambiarPassword={() => {
          setModalPassword(modalDetalleUsuario)
          setModalDetalleUsuario(null)
        }}
        onEliminar={() => {
          setModalEliminar(modalDetalleUsuario)
          setModalDetalleUsuario(null)
        }}
        onToggleActivo={async () => {
          if (!modalDetalleUsuario) return
          const { error } = await setActivo(modalDetalleUsuario.id, !modalDetalleUsuario.activo)
          if (error) {
            toast.error('No se pudo actualizar.')
            return
          }
          toast.success(modalDetalleUsuario.activo ? 'Usuario desactivado' : 'Usuario activado')
          setModalDetalleUsuario({ ...modalDetalleUsuario, activo: !modalDetalleUsuario.activo })
          refetchUsuarios()
        }}
      />

      <EditarUsuarioModal
        usuario={modalEditarUsuario}
        permiteElegirRol
        onCerrar={() => setModalEditarUsuario(null)}
        onGuardado={() => {
          setModalEditarUsuario(null)
          refetchUsuarios()
        }}
        editar={editar}
      />

      <CambiarPasswordModal
        usuario={modalPassword}
        onCerrar={() => setModalPassword(null)}
        cambiarPassword={cambiarPassword}
      />

      <ConfirmModal
        abierto={modalEliminar !== null}
        titulo="Eliminar usuario"
        mensaje={
          <>
            Se va a eliminar a <strong>{modalEliminar?.nombre}</strong> ({modalEliminar?.email}).
            Esta accion no se puede deshacer.
          </>
        }
        onCancelar={() => setModalEliminar(null)}
        onConfirmar={async () => {
          if (!modalEliminar) return
          const { error } = await eliminar(modalEliminar.id)
          if (error) toast.error(error)
          else {
            toast.success('Usuario eliminado')
            refetchUsuarios()
          }
          setModalEliminar(null)
        }}
      />
    </div>
  )
}

function EditarEmpresaModal({
  abierto,
  empresa,
  onCerrar,
  onGuardado,
  actualizar,
}: {
  abierto: boolean
  empresa: Empresa
  onCerrar: () => void
  onGuardado: (cambios: EmpresaUpdate) => void
  actualizar: ReturnType<typeof useEmpresas>['actualizar']
}) {
  const [nombre, setNombre] = useState('')
  const [ruc, setRuc] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(empresa.nombre)
    setRuc(empresa.ruc ?? '')
    setEmail(empresa.email ?? '')
    setTelefono(empresa.telefono ?? '')
    setDireccion(empresa.direccion ?? '')
    setError(null)
  }, [abierto, empresa])

  async function onGuardar() {
    if (!nombre.trim()) {
      setError('El nombre de la empresa es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    const cambios: EmpresaUpdate = {
      nombre: nombre.trim(),
      ruc: ruc.trim() || null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      direccion: direccion.trim() || null,
    }
    const { error: err } = await actualizar(empresa.id, cambios)
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    toast.success('Empresa actualizada')
    onGuardado(cambios)
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Editar empresa"
      onCerrar={onCerrar}
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre de la empresa *">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </Field>
        <Field label="RUC">
          <Input value={ruc} onChange={(e) => setRuc(e.target.value)} placeholder="80012345-6" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Telefono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Field>
        </div>
        <Field label="Direccion">
          <Textarea value={direccion} onChange={(e) => setDireccion(e.target.value)} rows={2} />
        </Field>
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

