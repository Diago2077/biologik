import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/**
 * Bloquea las rutas de la empresa (fincas, animales, conteos, datos de la
 * empresa) para el super_admin: no tiene `empresa_id`, y la RLS
 * (es_super_admin() pasa por encima del filtro por empresa) le traeria los
 * datos de TODAS las empresas mezclados sin distinguir a cual pertenece
 * cada uno. El super_admin administra empresas desde /admindrpcs, no tiene
 * una propia para ver aca.
 */
export default function RequiereEmpresa() {
  const { esSuperAdmin } = useAuth()
  if (esSuperAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
