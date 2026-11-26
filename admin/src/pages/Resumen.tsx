import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { SECCIONES } from '../layout/secciones'

export function Resumen() {
  const { sesion } = useAuth()
  if (!sesion) return null
  const visibles = SECCIONES.filter((s) => s.ruta !== '/' && s.alcances.includes(sesion.alcance))

  return (
    <>
      <h1>Hola, {sesion.nombreUsuario}</h1>
      <p className="subtitulo">
        {sesion.alcance === 'plataforma' && 'Ves y gestionas toda la plataforma.'}
        {sesion.alcance === 'entidad' && `Ves solo lo de tu entidad (id ${sesion.entidadId ?? '—'}).`}
        {(sesion.alcance === 'operador' || sesion.alcance === 'trabajador') && 'Ves las secciones de tu trabajo.'}
      </p>

      <div className="tarjetas">
        {visibles.map((s) => (
          <Link key={s.ruta} to={s.ruta} className="tarjeta">
            <h3>{s.nombre}</h3>
            <p>{s.descripcion}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
