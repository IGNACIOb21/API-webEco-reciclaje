// Pantalla de prueba de F4-01: lee datos del servidor simulado a través del cliente
// HTTP único y TanStack Query. La pantalla completa (crear, editar, mapa…) es F4-05.
import { useState } from 'react'
import { useCategorias, usePuntos } from '../api/consultas'
import { ESTADOS_OPERATIVOS, type EstadoOperativo, type FiltrosPuntos } from '../api/tipos'
import { useAuth } from '../auth/AuthContext'

const POR_PAGINA = 10
const ETIQUETA_ESTADO: Record<EstadoOperativo, string> = {
  operativo: 'Operativo',
  lleno: 'Lleno',
  mantenimiento: 'Mantenimiento',
  fuera_servicio: 'Fuera de servicio',
}
const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'America/Santiago' })

export function Puntos() {
  const { sesion } = useAuth()
  const [filtros, setFiltros] = useState<FiltrosPuntos>({ pagina: 1, por_pagina: POR_PAGINA, orden: 'nombre' })
  const puntos = usePuntos(filtros)
  const categorias = useCategorias()

  const cambiar = (cambio: Partial<FiltrosPuntos>) => setFiltros((f) => ({ ...f, pagina: 1, ...cambio }))
  const total = puntos.data?.paginacion.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <>
      <h1>Puntos de reciclaje</h1>
      <p className="subtitulo">
        {sesion?.alcance === 'entidad' ? 'Puntos de tu entidad.' : 'Todos los puntos de la plataforma.'}
      </p>

      <div className="filtros">
        <input type="search" placeholder="Buscar por nombre o dirección" aria-label="Buscar"
          onChange={(e) => cambiar({ buscar: e.target.value || undefined })} />
        <select aria-label="Estado" onChange={(e) => cambiar({ estado_operativo: (e.target.value || undefined) as EstadoOperativo | undefined })}>
          <option value="">Todos los estados</option>
          {ESTADOS_OPERATIVOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
        </select>
        <select aria-label="Material" onChange={(e) => cambiar({ categoria_residuo_id: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Todos los materiales</option>
          {categorias.data?.map((c) => <option key={c.categoria_residuo_id} value={c.categoria_residuo_id}>{c.nombre}</option>)}
        </select>
        <select aria-label="Orden" value={filtros.orden} onChange={(e) => cambiar({ orden: e.target.value })}>
          <option value="nombre">Nombre (A-Z)</option>
          <option value="-actualizado_en">Actualizado recientemente</option>
          <option value="comuna">Comuna</option>
        </select>
      </div>

      {puntos.isError ? (
        <div className="alerta alerta-error" role="alert">{puntos.error.message}</div>
      ) : (
        <div className={`tabla-envoltura ${puntos.isFetching ? 'actualizando' : ''}`}>
          <table className="tabla">
            <thead>
              <tr><th>Nombre</th><th>Comuna</th><th>Materiales</th><th>Estado</th><th>Entidad</th><th>Actualizado</th></tr>
            </thead>
            <tbody>
              {puntos.isPending && <tr><td colSpan={6} className="celda-vacia">Cargando…</td></tr>}
              {puntos.data?.datos.length === 0 && <tr><td colSpan={6} className="celda-vacia">No hay puntos con esos filtros.</td></tr>}
              {puntos.data?.datos.map((p) => (
                <tr key={p.punto_reciclaje_id}>
                  <td><strong>{p.nombre}</strong><div className="secundario">{p.direccion}</div></td>
                  <td>{p.comuna}</td>
                  <td>{p.categorias.map((c) => c.nombre).join(', ')}</td>
                  <td><span className={`insignia estado-${p.estado_operativo}`}>{ETIQUETA_ESTADO[p.estado_operativo]}</span></td>
                  <td>{p.entidad_nombre ?? '—'}</td>
                  <td>{fecha.format(new Date(p.actualizado_en))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="paginacion">
        <span>{total} puntos · página {filtros.pagina} de {paginas}</span>
        <button disabled={filtros.pagina === 1} onClick={() => setFiltros((f) => ({ ...f, pagina: (f.pagina ?? 1) - 1 }))}>Anterior</button>
        <button disabled={(filtros.pagina ?? 1) >= paginas} onClick={() => setFiltros((f) => ({ ...f, pagina: (f.pagina ?? 1) + 1 }))}>Siguiente</button>
      </div>
    </>
  )
}
