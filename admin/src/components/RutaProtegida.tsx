import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Alcance } from '../services/auth'

// Sin sesión → /login. Sin permiso para la sección → Resumen.
// Ojo: esto solo oculta pantallas; la API igual valida el rol en cada endpoint.
export function RutaProtegida({ children, alcances }: { children: ReactNode; alcances?: Alcance[] }) {
  const { sesion, cargando } = useAuth()
  const ubicacion = useLocation()

  if (cargando) return <div className="cargando">Cargando…</div>
  if (!sesion) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  if (alcances && !alcances.includes(sesion.alcance)) return <Navigate to="/" replace />
  return <>{children}</>
}
