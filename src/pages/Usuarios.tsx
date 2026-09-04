import { Plus, Search, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox, Vacio } from '@/components/ui/estado'
import { Input } from '@/components/ui/field'
import { ConfirmModal } from '@/components/ui/modal'
import {
  CambiarPasswordModal,
  EditarUsuarioModal,
  NuevoUsuarioModal,
  UsuarioDetalleModal,
} from '@/components/usuarios/UsuarioModales'
import { useAuth } from '@/hooks/useAuth'
import { useUsuarios } from '@/hooks/useUsuarios'
import { ROL_LABEL, type Usuario } from '@/lib/database.types'
import { normalizar } from '@/lib/format'

export default function Usuarios() {
  const { perfil, empresa } = useAuth()
  const navigate = useNavigate()

  // Ver quien tiene acceso al empresa es cosa de quien lo administra: un
  // usuario raso ni entra a esta pantalla (la RLS tampoco le deja leer la
  // lista, esto solo evita que se quede mirando una pantalla vacia/rota).
  useEffect(() => {
    if (perfil && perfil.rol === 'usuario') navigate('/', { replace: true })
  }, [perfil, navigate])

  const { data, loading, error, refetch, crear, editar, eliminar, cambiarPassword, setActivo } = useUsuarios(
    empresa?.id,
  )
  const puedeGestionar = perfil?.rol === 'admin'
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return data
    return data.filter((u) => normalizar(u.nombre).includes(q) || normalizar(u.email).includes(q))
  }, [data, busqueda])

  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalDetalle, setModalDetalle] = useState<Usuario | null>(null)
  const [modalEditar, setModalEditar] = useState<Usuario | null>(null)
  const [modalPassword, setModalPassword] = useState<Usuario | null>(null)
  const [modalEliminar, setModalEliminar] = useState<Usuario | null>(null)

  if (perfil?.rol === 'usuario') return null

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {puedeGestionar
              ? `Quienes tienen acceso a ${empresa?.nombre ?? 'esta empresa'}.`
              : `Quienes tienen acceso a ${empresa?.nombre ?? 'esta empresa'}. Las altas y bajas las gestiona el administrador.`}
          </p>
        </div>
        {puedeGestionar && (
          <Button onClick={() => setModalNuevo(true)}>
            <Plus /> Nuevo usuario
          </Button>
        )}
      </div>

      {data.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o email…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <Cargando />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : data.length === 0 ? (
        <Vacio icono={UserRound} titulo="Sin usuarios" />
      ) : filtrados.length === 0 ? (
        <Vacio icono={UserRound} titulo="Sin resultados" descripcion="Probá con otra busqueda." />
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
              {filtrados.map((u) => {
                // Un admin solo puede administrar usuarios 'usuario': a otro
                // admin (o a si mismo) lo ve, pero la fila no abre el detalle.
                const clickeable = puedeGestionar && u.rol === 'usuario'
                return (
                  <tr
                    key={u.id}
                    onClick={clickeable ? () => setModalDetalle(u) : undefined}
                    className={
                      clickeable
                        ? 'cursor-pointer border-b border-border last:border-0 hover:bg-accent/40'
                        : 'border-b border-border last:border-0'
                    }
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{u.nombre}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{ROL_LABEL[u.rol]}</td>
                    <td className="px-4 py-2.5">
                      <Badge tono={u.activo ? 'success' : 'neutral'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {puedeGestionar && empresa && (
        <>
          <NuevoUsuarioModal
            abierto={modalNuevo}
            empresaId={empresa.id}
            onCerrar={() => setModalNuevo(false)}
            onCreado={() => {
              setModalNuevo(false)
              refetch()
            }}
            crear={crear}
          />

          <UsuarioDetalleModal
            usuario={modalDetalle}
            onCerrar={() => setModalDetalle(null)}
            onEditar={() => {
              setModalEditar(modalDetalle)
              setModalDetalle(null)
            }}
            onCambiarPassword={() => {
              setModalPassword(modalDetalle)
              setModalDetalle(null)
            }}
            onEliminar={() => {
              setModalEliminar(modalDetalle)
              setModalDetalle(null)
            }}
            onToggleActivo={async () => {
              if (!modalDetalle) return
              const { error: err } = await setActivo(modalDetalle.id, !modalDetalle.activo)
              if (err) {
                toast.error('No se pudo actualizar.')
                return
              }
              toast.success(modalDetalle.activo ? 'Usuario desactivado' : 'Usuario activado')
              setModalDetalle({ ...modalDetalle, activo: !modalDetalle.activo })
              refetch()
            }}
          />

          <EditarUsuarioModal
            usuario={modalEditar}
            onCerrar={() => setModalEditar(null)}
            onGuardado={() => {
              setModalEditar(null)
              refetch()
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
              const { error: err } = await eliminar(modalEliminar.id)
              if (err) toast.error(err)
              else {
                toast.success('Usuario eliminado')
                refetch()
              }
              setModalEliminar(null)
            }}
          />
        </>
      )}
    </div>
  )
}

