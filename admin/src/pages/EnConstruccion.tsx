import type { Seccion } from '../layout/secciones'

export function EnConstruccion({ seccion }: { seccion: Seccion }) {
  return (
    <>
      <h1>{seccion.nombre}</h1>
      <p className="subtitulo">{seccion.descripcion}</p>
      <div className="vacio">
        <p>Próximamente.</p>
      </div>
    </>
  )
}
