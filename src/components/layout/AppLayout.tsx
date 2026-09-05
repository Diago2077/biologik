import { KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CambiarMiPasswordModal } from '@/components/cuenta/CambiarMiPasswordModal'
import { Button } from '@/components/ui/button'
import { Cargando } from '@/components/ui/estado'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const NAV_INICIO = { to: '/', label: 'Inicio', end: true }
const NAV_FINCAS = { to: '/fincas', label: 'Fincas', end: false }
const NAV_VACUNACIONES = { to: '/vacunaciones', label: 'Vacunaciones', end: false }
const NAV_USUARIOS = { to: '/usuarios', label: 'Usuarios', end: false }

export default function AppLayout() {
  const { user, perfil, empresa, loading, esSuperAdmin, problemaPerfil, signOut } = useAuth()
  const navigate = useNavigate()
  const [modalPassword, setModalPassword] = useState(false)

  // Fincas/animales/conteos son de la empresa: el super_admin no tiene una
  // (verlas todas mezcladas no tiene sentido, para eso esta /admindrpcs).
  // Gestionar usuarios es cosa de quien administra la empresa: un usuario
  // raso ni ve el link ni tiene acceso a esos datos (la RLS tambien lo corta).
  const NAV = [
    NAV_INICIO,
    ...(esSuperAdmin ? [] : [NAV_FINCAS, NAV_VACUNACIONES]),
    ...(perfil?.rol === 'usuario' ? [] : [NAV_USUARIOS]),
  ]

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [user, loading, navigate])

  if (loading) return <Cargando className="min-h-screen" texto="Cargando tu cuenta…" />
  if (!user) return null

  // Sesion valida sin fila en `usuarios`: sin esto la pantalla queda en blanco
  // y no hay forma de entender por que.
  if (problemaPerfil) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-xs">
          <h1 className="text-sm font-semibold text-foreground">
            {problemaPerfil === 'inactivo'
              ? 'Cuenta desactivada'
              : problemaPerfil === 'empresa-inactiva'
                ? 'Empresa desactivada'
                : 'Cuenta sin configurar'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {problemaPerfil === 'inactivo'
              ? 'Tu usuario fue desactivado. Contactate con el administrador del sistema.'
              : problemaPerfil === 'empresa-inactiva'
                ? 'La empresa a la que pertenecés fue desactivada. Contactate con el administrador del sistema.'
                : 'Tu usuario existe pero todavía no está asignado a ninguna empresa. Contactate con el administrador del sistema.'}
          </p>
          <Button variant="outline" className="mt-5" onClick={signOut}>
            <LogOut /> Cerrar sesión
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img src="/logo.svg" alt="" className="size-7 shrink-0 rounded-md" />
            <span className="truncate text-sm font-semibold text-foreground">
              {empresa?.nombre ?? (esSuperAdmin ? 'Administración' : 'Biologik S.A.')}
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {esSuperAdmin && (
              <Link
                to="/admindrpcs"
                className="hidden items-center gap-1.5 rounded-md bg-warning/15 px-2.5 py-1.5 text-xs font-medium text-warning sm:flex"
              >
                <ShieldCheck className="size-3.5" />
                Super admin
              </Link>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-foreground">{perfil?.nombre}</p>
              <p className="text-[11px] text-muted-foreground">{perfil?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setModalPassword(true)}
              title="Cambiar mi contraseña"
            >
              <KeyRound />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesión">
              <LogOut />
            </Button>
          </div>
        </div>

        {/* Navegacion en mobile: la fila de arriba se queda sin lugar */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 sm:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-sm',
                  isActive
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <CambiarMiPasswordModal abierto={modalPassword} onCerrar={() => setModalPassword(false)} />
    </div>
  )
}
