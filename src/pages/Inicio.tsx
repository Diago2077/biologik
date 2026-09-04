import { Building2, MapPin, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { formatNumero } from '@/lib/format'
import { supabase } from '@/lib/supabase'

interface Modulo {
  to: string
  titulo: string
  descripcion: string
  icono: ComponentType<{ className?: string }>
  destacado?: boolean
}

interface Resumen {
  fincas: number
  animales: number
  garrapatas: number
}

export default function Inicio() {
  const { perfil, empresa, esSuperAdmin } = useAuth()
  const [resumen, setResumen] = useState<Resumen | null>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      const [f, a, c] = await Promise.all([
        supabase.from('fincas').select('*', { count: 'exact', head: true }),
        supabase.from('animales').select('*', { count: 'exact', head: true }),
        supabase.from('conteos').select('count_total'),
      ])
      if (cancelado) return
      const totales = (c.data as { count_total: number }[] | null) ?? []
      setResumen({
        fincas: f.count ?? 0,
        animales: a.count ?? 0,
        garrapatas: totales.reduce((suma, fila) => suma + fila.count_total, 0),
      })
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [])

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

      {empresa && resumen && (
        <div className="mb-7 grid gap-3 sm:grid-cols-3">
          <Tarjeta etiqueta="Fincas" valor={formatNumero(resumen.fincas)} />
          <Tarjeta etiqueta="Animales" valor={formatNumero(resumen.animales)} />
          <Tarjeta etiqueta="Garrapatas contadas" valor={formatNumero(resumen.garrapatas)} destacado />
        </div>
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

function Tarjeta({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string
  valor: string
  destacado?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (destacado ? 'text-primary' : 'text-foreground')
        }
      >
        {valor}
      </p>
    </div>
  )
}
