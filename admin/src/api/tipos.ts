// Tipos del contrato de la API (tarjeta F0-05).
// Enums: valores reales extraídos de la base en F0-01 (docs/esquema.md).
// ⚠️ Los campos de cada recurso son PROVISIONALES: ajustarlos a docs/esquema.md
//    y a docs/api.yaml cuando estén en el repositorio.

// ---------- Convenciones generales ----------
export interface ErrorContrato {
  error: { codigo: string; mensaje: string; detalles?: unknown }
}

export interface Paginado<T> {
  datos: T[]
  paginacion: { pagina: number; por_pagina: number; total: number }
}

export interface ParametrosLista {
  pagina?: number
  por_pagina?: number
  orden?: string // ej: "nombre" o "-actualizado_en" (descendente)
  buscar?: string
}

// ---------- Enums (F0-01) ----------
export const ESTADOS_OPERATIVOS = ['operativo', 'lleno', 'mantenimiento', 'fuera_servicio'] as const
export type EstadoOperativo = (typeof ESTADOS_OPERATIVOS)[number]

export const TIPOS_ENTIDAD = ['municipalidad', 'empresa', 'organizacion', 'centro_reciclaje', 'otra'] as const
export type TipoEntidad = (typeof TIPOS_ENTIDAD)[number]

export const ESTADOS_CANJE = ['pendiente', 'aprobado', 'entregado', 'cancelado', 'rechazado'] as const
export type EstadoCanje = (typeof ESTADOS_CANJE)[number]

export const ESTADOS_REPORTE = ['pendiente', 'en_revision', 'resuelto', 'rechazado'] as const
export type EstadoReporte = (typeof ESTADOS_REPORTE)[number]

export const ESTADOS_TICKET = ['pendiente', 'en_proceso', 'resuelto', 'cancelado'] as const
export type EstadoTicket = (typeof ESTADOS_TICKET)[number]

// ---------- Roles (F0-03) ----------
export const ROLES = ['ciudadano', 'super_admin', 'admin_entidad', 'operador', 'trabajador'] as const
export type Rol = (typeof ROLES)[number]

// ---------- Autenticación ----------
export interface PeticionLogin {
  correo_electronico: string
  contrasena: string
}

export interface RespuestaTokens {
  token_acceso: string
  token_refresco: string
}

export interface UsuarioActual {
  usuario_id: number
  nombre_usuario: string
  correo_electronico: string
  roles: string[]
  entidad_administradora_id: number | null
}

// ---------- Recursos del panel ----------
export interface CategoriaResiduo {
  categoria_residuo_id: number
  nombre: string
  codigo_color: string
}

export interface EntidadAdministradora {
  entidad_administradora_id: number
  nombre: string
  tipo_entidad: TipoEntidad
  activo: boolean
}

export interface PuntoReciclaje {
  punto_reciclaje_id: number
  nombre: string
  direccion: string
  comuna: string
  latitud: number
  longitud: number
  estado_operativo: EstadoOperativo
  entidad_administradora_id: number | null
  entidad_nombre: string | null
  categorias: Pick<CategoriaResiduo, 'categoria_residuo_id' | 'nombre'>[]
  actualizado_en: string // ISO 8601 UTC
}

export interface FiltrosPuntos extends ParametrosLista {
  estado_operativo?: EstadoOperativo
  comuna?: string
  categoria_residuo_id?: number
}
