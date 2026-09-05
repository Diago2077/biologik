import { Route, Routes } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import RequiereEmpresa from '@/components/layout/RequiereEmpresa'
import SuperAdminLayout from '@/components/layout/SuperAdminLayout'
import AnimalDetalle from '@/pages/AnimalDetalle'
import Empresa from '@/pages/Empresa'
import FincaDetalle from '@/pages/FincaDetalle'
import Fincas from '@/pages/Fincas'
import Inicio from '@/pages/Inicio'
import Login from '@/pages/Login'
import NoEncontrado from '@/pages/NoEncontrado'
import Usuarios from '@/pages/Usuarios'
import Vacunaciones from '@/pages/Vacunaciones'
import Cargar from '@/pages/conteos/Cargar'
import ConfiguracionIA from '@/pages/admin/ConfiguracionIA'
import EmpresaDetalle from '@/pages/admin/EmpresaDetalle'
import Empresas from '@/pages/admin/Empresas'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<AppLayout />}>
        <Route index element={<Inicio />} />
        <Route element={<RequiereEmpresa />}>
          <Route path="fincas" element={<Fincas />} />
          <Route path="fincas/:id" element={<FincaDetalle />} />
          <Route path="animales/:id" element={<AnimalDetalle />} />
          <Route path="animales/:id/cargar" element={<Cargar />} />
          <Route path="vacunaciones" element={<Vacunaciones />} />
          <Route path="empresa" element={<Empresa />} />
        </Route>
        <Route path="usuarios" element={<Usuarios />} />
      </Route>

      <Route path="/admindrpcs" element={<SuperAdminLayout />}>
        <Route index element={<Empresas />} />
        <Route path="configuracion-ia" element={<ConfiguracionIA />} />
        <Route path=":id" element={<EmpresaDetalle />} />
      </Route>

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}
