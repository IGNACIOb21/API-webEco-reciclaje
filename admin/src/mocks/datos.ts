// Datos falsos para el servidor simulado. Respetan los tipos del contrato (src/api/tipos.ts).
import type { CategoriaResiduo, EntidadAdministradora, EstadoOperativo, PuntoReciclaje, UsuarioActual } from '../api/tipos'

export const CONTRASENA_DEMO = 'rebin1234'

export const USUARIOS: UsuarioActual[] = [
  { usuario_id: 1, nombre_usuario: 'superadmin', correo_electronico: 'superadmin@rebin.cl', roles: ['ciudadano', 'super_admin'], entidad_administradora_id: null },
  { usuario_id: 2, nombre_usuario: 'muni_providencia', correo_electronico: 'entidad@rebin.cl', roles: ['ciudadano', 'admin_entidad'], entidad_administradora_id: 1 },
  { usuario_id: 3, nombre_usuario: 'operador1', correo_electronico: 'operador@rebin.cl', roles: ['ciudadano', 'operador'], entidad_administradora_id: null },
  { usuario_id: 4, nombre_usuario: 'prueba1', correo_electronico: 'ciudadano@rebin.cl', roles: ['ciudadano'], entidad_administradora_id: null },
]

export const CATEGORIAS: CategoriaResiduo[] = [
  { categoria_residuo_id: 1, nombre: 'Plástico', codigo_color: '#E3A133' },
  { categoria_residuo_id: 2, nombre: 'Papel y cartón', codigo_color: '#2F78C4' },
  { categoria_residuo_id: 3, nombre: 'Vidrio', codigo_color: '#3D8B5A' },
  { categoria_residuo_id: 4, nombre: 'Latas', codigo_color: '#8C8C8C' },
  { categoria_residuo_id: 5, nombre: 'Aceite usado', codigo_color: '#8A4B33' },
]

export const ENTIDADES: EntidadAdministradora[] = [
  { entidad_administradora_id: 1, nombre: 'Municipalidad de Providencia', tipo_entidad: 'municipalidad', activo: true },
  { entidad_administradora_id: 2, nombre: 'Municipalidad de Ñuñoa', tipo_entidad: 'municipalidad', activo: true },
  { entidad_administradora_id: 3, nombre: 'Recicla Chile SpA', tipo_entidad: 'empresa', activo: true },
  { entidad_administradora_id: 4, nombre: 'Centro de Reciclaje Maipú', tipo_entidad: 'centro_reciclaje', activo: true },
]

const COMUNAS: [string, number, number, number][] = [
  // comuna, latitud, longitud, entidad
  ['Providencia', -33.4314, -70.6093, 1],
  ['Ñuñoa', -33.4569, -70.5978, 2],
  ['Santiago', -33.4489, -70.6693, 3],
  ['Maipú', -33.5110, -70.7580, 4],
  ['Las Condes', -33.4080, -70.5670, 3],
]
const CALLES = ['Av. Providencia', 'Irarrázaval', 'Los Leones', 'Pedro de Valdivia', 'Av. Pajaritos', 'Grecia', 'Manuel Montt', 'Tobalaba']
const LUGARES = ['Punto Limpio', 'Campana', 'Contenedor', 'Ecopunto']
const ESTADOS: EstadoOperativo[] = ['operativo', 'operativo', 'operativo', 'lleno', 'mantenimiento', 'fuera_servicio']

// Generador con semilla: siempre produce los mismos datos.
let semilla = 42
const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646

export const PUNTOS: PuntoReciclaje[] = Array.from({ length: 38 }, (_, i) => {
  const [comuna, lat, lng, entidadId] = COMUNAS[i % COMUNAS.length]
  const calle = CALLES[Math.floor(azar() * CALLES.length)]
  const cats = CATEGORIAS.filter(() => azar() > 0.45)
  const entidad = ENTIDADES.find((e) => e.entidad_administradora_id === entidadId)!
  return {
    punto_reciclaje_id: i + 1,
    nombre: `${LUGARES[i % LUGARES.length]} ${calle.replace('Av. ', '')} ${100 + i}`,
    direccion: `${calle} ${Math.floor(100 + azar() * 3900)}, ${comuna}`,
    comuna,
    latitud: +(lat + (azar() - 0.5) * 0.03).toFixed(6),
    longitud: +(lng + (azar() - 0.5) * 0.03).toFixed(6),
    estado_operativo: ESTADOS[Math.floor(azar() * ESTADOS.length)],
    entidad_administradora_id: entidadId,
    entidad_nombre: entidad.nombre,
    categorias: (cats.length ? cats : [CATEGORIAS[0]]).map(({ categoria_residuo_id, nombre }) => ({ categoria_residuo_id, nombre })),
    actualizado_en: new Date(Date.UTC(2026, 10, 25) - Math.floor(azar() * 60) * 86400000).toISOString(),
  }
})
