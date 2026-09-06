import { AlertTriangle, Building2, MapPin, ShieldCheck, Syringe, Users } from 'lucide-react'
import { type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useVacunacionesPendientes } from '@/hooks/useVacunacionesPendientes'

interface Modulo {
  to: string
  titulo: string
  descripcion: string
  icono: ComponentType<{ className?: string }>
  destacado?: boolean
}

export default function Inicio() {
  const { perfil, empresa, esSuperAdmin } = useAuth()
  const { vencidas, porVencer } = useVacunacionesPendientes()
  const pendientes = vencidas + porVencer

  // Fincas/animales/conteos son de la empresa: el super_admin no tiene una
  // propia (la RLS le mostraria las de todas las empresas mezcladas).
  const modulos: Modulo[] = esSuperAdmin
    ? []
    : [
        {
          to: '/fincas',
          titulo: 'Fincas',
          descripcion:
            'Los establecimientos de la empresa. Desde acá se entra a los animales y a sus conteos de garrapatas.',
          icono: MapPin,
          destacado: true,
        },
        {
          to: '/vacunaciones',
          titulo: 'Vacunaciones',
          descripcion: 'Cuándo le toca la próxima dosis a cada animal, y qué está vencido.',
          icono: Syringe,
        },
      ]

  // Un usuario raso solo trabaja con fincas/animales/conteos: la gestion de
  // usuarios es cosa de quien administra la empresa.
  if (perfil?.rol !== 'usuario') {
    modulos.push({
      to: '/usuarios',
      titulo: 'Usuarios',
      descripcion: 'Quiénes tienen acceso a la empresa.',
      icono: Users,
    })
  }

  // "Mi empresa" tampoco es para el super_admin: no tiene una propia.
  if (!esSuperAdmin) {
    modulos.push({
      to: '/empresa',
      titulo: 'Mi empresa',
      descripcion: 'Datos de la empresa.',
      icono: Building2,
    })
  }

  if (esSuperAdmin) {
    modulos.push({
      to: '/admindrpcs',
      titulo: 'Administración del sistema',
      descripcion: 'Alta de empresas y de sus usuarios.',
      icono: ShieldCheck,
    })
  }

  const primerNombre = perfil?.nombre?.split(' ')[0] ?? ''

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-foreground">
          Hola{primerNombre ? `, ${primerNombre}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {empresa
            ? empresa.nombre
            : esSuperAdmin
              ? 'Estás conectado como administrador del sistema.'
              : ''}
        </p>
      </div>

      {empresa && pendientes > 0 && (
        <Link
          to="/vacunaciones"
          className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 transition-colors hover:bg-warning/10"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {pendientes === 1 ? 'Hay 1 vacunación pendiente' : `Hay ${pendientes} vacunaciones pendientes`}
            </p>
            <p className="text-xs text-muted-foreground">
              {vencidas > 0 && `${vencidas} ${vencidas === 1 ? 'vencida' : 'vencidas'}`}
              {vencidas > 0 && porVencer > 0 && ' · '}
              {porVencer > 0 && `${porVencer} por vencer en los próximos 15 días`}
            </p>
          </div>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map(({ to, titulo, descripcion, icono: Icono, destacado }) => (
          <Link
            key={to}
            to={to}
            className={
              'group rounded-lg border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' +
              (destacado ? ' sm:col-span-2 lg:col-span-1' : '')
            }
          >
            <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icono className="size-4.5" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
