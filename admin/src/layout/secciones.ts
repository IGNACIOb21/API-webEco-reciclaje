// Pestañas de la barra lateral (orden del Informe Web API Rebin v2).
// "alcances" = quién ve cada pestaña. PROVISIONAL: la matriz oficial es la de F0-03
// (docs/roles-permisos.md) y la aplica F4-02.
import type { Alcance } from '../services/auth'

export interface Seccion {
  ruta: string
  nombre: string
  alcances: Alcance[]
  tarjeta: string
  descripcion: string
}

const TODOS: Alcance[] = ['plataforma', 'entidad', 'operador', 'trabajador']
const ADMINS: Alcance[] = ['plataforma', 'entidad']

export const SECCIONES: Seccion[] = [
  { ruta: '/', nombre: 'Resumen', alcances: TODOS, tarjeta: 'F4-04', descripcion: 'Cifras clave, puntos pendientes de aprobación y reportes recientes.' },
  { ruta: '/puntos', nombre: 'Puntos de reciclaje', alcances: ADMINS, tarjeta: 'F4-05', descripcion: 'Crear, editar, desactivar y reactivar puntos; sugerencias de nuevos puntos.' },
  { ruta: '/reportes', nombre: 'Reportes y mantención', alcances: TODOS, tarjeta: 'F4-10', descripcion: 'Bandeja de alertas: asignar, iniciar y resolver.' },
  { ruta: '/depositos', nombre: 'Depósitos', alcances: ['plataforma', 'operador'], tarjeta: 'F4-08', descripcion: 'Cola de reciclajes dudosos para aprobar o rechazar.' },
  { ruta: '/reglas', nombre: 'Reglas de puntuación', alcances: ADMINS, tarjeta: 'F4-06', descripcion: 'Reglas, límites diarios y niveles.' },
  { ruta: '/beneficios', nombre: 'Beneficios y canjes', alcances: ADMINS, tarjeta: 'F4-09', descripcion: 'Catálogo de beneficios y cola de canjes por código.' },
  { ruta: '/sugerencias', nombre: 'Sugerencias de puntos', alcances: ['plataforma'], tarjeta: 'F4-07', descripcion: 'Puntos propuestos por usuarios: aprobar o rechazar.' },
  { ruta: '/comunidad', nombre: 'Comunidad y eventos', alcances: ADMINS, tarjeta: 'F4-12', descripcion: 'Comunidades, logros, eventos y avisos.' },
  { ruta: '/entidades', nombre: 'Entidades', alcances: ['plataforma'], tarjeta: 'F4-05', descripcion: 'Municipalidades, empresas y organizaciones.' },
  { ruta: '/usuarios', nombre: 'Usuarios y roles', alcances: ['plataforma'], tarjeta: 'F4-11', descripcion: 'Buscar usuarios, asignar y quitar roles.' },
  { ruta: '/estadisticas', nombre: 'Estadísticas', alcances: ADMINS, tarjeta: 'F4-13', descripcion: 'Evolución semanal y totales por periodo.' },
  { ruta: '/auditoria', nombre: 'Auditoría', alcances: ['plataforma'], tarjeta: 'F4-14', descripcion: 'Quién hizo qué y cuándo; matriz de permisos.' },
]

export const NOMBRE_ALCANCE: Record<Alcance, string> = {
  plataforma: 'Super administrador',
  entidad: 'Administrador de entidad',
  operador: 'Operador',
  trabajador: 'Trabajador',
}
