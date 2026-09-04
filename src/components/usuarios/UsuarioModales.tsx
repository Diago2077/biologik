import { KeyRound, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useUsuarios } from '@/hooks/useUsuarios'
import type { Usuario } from '@/lib/database.types'
import { ROL_LABEL } from '@/lib/database.types'
import { formatFecha } from '@/lib/format'

/**
 * Modales de gestion de usuarios, compartidos por las dos pantallas que los
 * necesitan: la de la empresa (/usuarios) y la del super_admin
 * (/admindrpcs/empresas/:id).
 *
 * La unica diferencia entre ambas es quien puede repartir roles: el
 * super_admin decide si el usuario nuevo es admin o usuario comun, mientras
 * que un admin de empresa solo puede dar de alta usuarios comunes -- si
 * pudiera crear otros admin, podria repartir su propio nivel de acceso. Esa
 * diferencia entra por `permiteElegirRol`; el resto del formulario es igual.
 */

type RolAsignable = 'admin' | 'usuario'

function SelectorDeRol({ valor, onCambiar }: { valor: RolAsignable; onCambiar: (rol: RolAsignable) => void }) {
  return (
    <Field label="Rol">
      <Select value={valor} onChange={(e) => onCambiar(e.target.value as RolAsignable)}>
        <option value="usuario">Usuario</option>
        <option value="admin">Admin</option>
      </Select>
    </Field>
  )
}

export function NuevoUsuarioModal({
  abierto,
  empresaId,
  permiteElegirRol = false,
  onCerrar,
  onCreado,
  crear,
}: {
  abierto: boolean
  empresaId: string
  permiteElegirRol?: boolean
  onCerrar: () => void
  onCreado: () => void
  crear: ReturnType<typeof useUsuarios>['crear']
}) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<RolAsignable>('usuario')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (abierto) {
      setNombre('')
      setEmail('')
      setPassword('')
      setRol('usuario')
      setError(null)
    }
  }, [abierto])

  async function onGuardar() {
    if (!nombre.trim() || !email.trim() || !password) {
      setError('Completa todos los campos.')
      return
    }
    setGuardando(true)
    setError(null)
    const { error: err } = await crear({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      email: email.trim(),
      password,
      rol: permiteElegirRol ? rol : 'usuario',
    })
    setGuardando(false)
    if (err) setError(err)
    else {
      toast.success('Usuario creado')
      onCreado()
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Nuevo usuario"
      onCerrar={onCerrar}
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre *">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" autoFocus />
        </Field>
        <Field label="Email *" hint="No repitas tu propio email: cada cuenta necesita uno distinto.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Contrasena *" hint="Minimo 8 caracteres">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {permiteElegirRol && <SelectorDeRol valor={rol} onCambiar={setRol} />}
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

export function UsuarioDetalleModal({
  usuario,
  onCerrar,
  onEditar,
  onCambiarPassword,
  onEliminar,
  onToggleActivo,
}: {
  usuario: Usuario | null
  onCerrar: () => void
  onEditar: () => void
  onCambiarPassword: () => void
  onEliminar: () => void
  onToggleActivo: () => void
}) {
  if (!usuario) return null

  return (
    <Modal
      abierto={usuario !== null}
      titulo="Detalle de usuario"
      onCerrar={onCerrar}
      ancho="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onEliminar}>
            <Trash2 className="text-destructive" /> Eliminar
          </Button>
          <Button variant="outline" onClick={onCambiarPassword}>
            <KeyRound /> Contrasena
          </Button>
          <Button onClick={onEditar}>
            <Pencil /> Editar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{usuario.nombre}</h2>
            <p className="text-sm text-muted-foreground">{usuario.email}</p>
          </div>
          <button onClick={onToggleActivo}>
            <Badge tono={usuario.activo ? 'success' : 'neutral'}>
              {usuario.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Rol</p>
            <p className="text-foreground">{ROL_LABEL[usuario.rol]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Alta</p>
            <p className="text-foreground">{formatFecha(usuario.created_at)}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Tocá el estado para {usuario.activo ? 'desactivarlo' : 'activarlo'}.
        </p>
      </div>
    </Modal>
  )
}

export function EditarUsuarioModal({
  usuario,
  permiteElegirRol = false,
  onCerrar,
  onGuardado,
  editar,
}: {
  usuario: Usuario | null
  permiteElegirRol?: boolean
  onCerrar: () => void
  onGuardado: () => void
  editar: ReturnType<typeof useUsuarios>['editar']
}) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<RolAsignable>('usuario')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!usuario) return
    setNombre(usuario.nombre)
    setEmail(usuario.email)
    setRol(usuario.rol === 'admin' ? 'admin' : 'usuario')
    setError(null)
  }, [usuario])

  async function onGuardar() {
    if (!usuario) return
    if (!nombre.trim() || !email.trim()) {
      setError('Completa todos los campos.')
      return
    }
    setGuardando(true)
    setError(null)
    const { error: err } = await editar({
      id: usuario.id,
      nombre: nombre.trim(),
      email: email.trim(),
      rol: permiteElegirRol ? rol : 'usuario',
    })
    setGuardando(false)
    if (err) setError(err)
    else {
      toast.success('Usuario actualizado')
      onGuardado()
    }
  }

  return (
    <Modal
      abierto={usuario !== null}
      titulo={`Editar usuario — ${usuario?.nombre ?? ''}`}
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
        <Field label="Nombre *">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </Field>
        <Field label="Email *" hint="Es el email con el que inicia sesion: cambiarlo cambia su login.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {permiteElegirRol && <SelectorDeRol valor={rol} onCambiar={setRol} />}
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

export function CambiarPasswordModal({
  usuario,
  onCerrar,
  cambiarPassword,
}: {
  usuario: Usuario | null
  onCerrar: () => void
  cambiarPassword: ReturnType<typeof useUsuarios>['cambiarPassword']
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setPassword('')
    setError(null)
  }, [usuario])

  async function onGuardar() {
    if (!usuario) return
    if (password.length < 8) {
      setError('Minimo 8 caracteres.')
      return
    }
    setGuardando(true)
    const { error: err } = await cambiarPassword(usuario.id, password)
    setGuardando(false)
    if (err) setError(err)
    else {
      toast.success('Contrasena actualizada')
      onCerrar()
    }
  }

  return (
    <Modal
      abierto={usuario !== null}
      titulo={`Cambiar contrasena — ${usuario?.nombre ?? ''}`}
      onCerrar={onCerrar}
      ancho="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Cambiar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nueva contrasena" hint="Minimo 8 caracteres">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}
