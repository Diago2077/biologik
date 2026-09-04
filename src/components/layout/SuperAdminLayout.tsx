import { ArrowLeft, Building2, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CambiarMiPasswordModal } from '@/components/cuenta/CambiarMiPasswordModal'
import { Button } from '@/components/ui/button'
import { Cargando } from '@/components/ui/estado'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/admindrpcs', label: 'Empresas', end: true },
  { to: '/admindrpcs/configuracion-ia', label: 'Configuracion de IA', end: true },
]

export default function SuperAdminLayout() {
  const { user, perfil, loading, esSuperAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [modalPassword, setModalPassword] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) navigate('/login', { replace: true })
    else if (!esSuperAdmin) navigate('/', { replace: true })
  }, [user, loading, esSuperAdmin, navigate])

  if (loading) return <Cargando className="min-h-screen" texto="Verificando acceso…" />
  if (!user || !esSuperAdmin) return null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/admindrpcs" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-warning/20 text-warning">
              <ShieldCheck className="size-4" />
            </span>
            <span className="text-sm font-semibold text-foreground">Administracion del sistema</span>
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
            <Link
              to="/"
              className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:flex"
            >
              <ArrowLeft className="size-3.5" />
              <Building2 className="size-3.5" />
              Volver a la app
            </Link>
            <p className="hidden text-xs font-medium text-foreground sm:block">{perfil?.nombre}</p>
            <Button variant="ghost" size="icon" onClick={() => setModalPassword(true)} title="Cambiar mi contrasena">
              <KeyRound />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesion">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <CambiarMiPasswordModal abierto={modalPassword} onCerrar={() => setModalPassword(false)} />
    </div>
  )
}
