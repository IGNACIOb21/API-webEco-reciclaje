import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { NOMBRE_ALCANCE, SECCIONES } from './secciones'

export function PanelLayout() {
  const { sesion, salir } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  if (!sesion) return null

  const visibles = SECCIONES.filter((s) => s.alcances.includes(sesion.alcance))

  return (
    <div className="panel">
      <aside className={`lateral ${menuAbierto ? 'abierto' : ''}`}>
        <div className="marca">
          <span className="marca-logo" aria-hidden>♻</span>
          <span className="marca-nombre">Rebin</span>
        </div>
        <nav onClick={() => setMenuAbierto(false)}>
          {visibles.map((s) => (
            <NavLink key={s.ruta} to={s.ruta} end={s.ruta === '/'} className="enlace">
              {s.nombre}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-pie">
          <div className="usuario-nombre">{sesion.nombreUsuario}</div>
          <div className="usuario-rol">{NOMBRE_ALCANCE[sesion.alcance]}</div>
          <button className="boton-salir" onClick={() => salir()}>Cerrar sesión</button>
        </div>
      </aside>

      <div className="contenido">
        <header className="barra-superior">
          <button className="boton-menu" onClick={() => setMenuAbierto((v) => !v)} aria-label="Abrir menú">☰</button>
        </header>
        <main className="principal">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
