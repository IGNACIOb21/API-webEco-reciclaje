// Autenticación del panel: mismos endpoints que la app (F2-03 / F2-04),
// pero solo dejan entrar los roles de personal (matriz de F0-03).
import type { PeticionLogin, RespuestaTokens, UsuarioActual } from '../api/tipos'
import { pedir } from './api'

export type Alcance = 'plataforma' | 'entidad' | 'operador' | 'trabajador'

export interface Sesion {
  usuarioId: number
  nombreUsuario: string
  correo: string
  roles: string[]
  alcance: Alcance
  entidadId: number | null
}

// Rol → alcance en el panel. "administrador" es el nombre que hoy existe en la base;
// se mantiene mientras no se migre a los roles de F0-03.
const ALCANCE_POR_ROL: [string, Alcance][] = [
  ['super_admin', 'plataforma'],
  ['administrador', 'plataforma'],
  ['admin_entidad', 'entidad'],
  ['operador', 'operador'],
  ['trabajador', 'trabajador'],
]

export function alcanceDe(roles: string[]): Alcance | null {
  for (const [rol, alcance] of ALCANCE_POR_ROL) if (roles.includes(rol)) return alcance
  return null // ciudadano u otro: no entra al panel
}

// ---------- Adaptador para unificar con la API real ----------
// Acepta los nombres de campo más comunes, para que el panel funcione aunque la API
// use otros (camelCase, "token", "user", etc.). Al acordar el contrato final, se simplifica aquí.
type Suelto = Record<string, unknown>
const primero = (o: Suelto, ...claves: string[]) => claves.map((k) => o?.[k]).find((v) => v !== undefined && v !== null)

export function normalizarTokens(r: Suelto): RespuestaTokens {
  const fuente = (primero(r, 'datos', 'data') as Suelto) ?? r
  const token_acceso = primero(fuente, 'token_acceso', 'tokenAcceso', 'accessToken', 'access_token', 'token') as string
  const token_refresco = primero(fuente, 'token_refresco', 'tokenRefresco', 'refreshToken', 'refresh_token') as string
  if (!token_acceso) throw new Error('La API no devolvió un token de acceso.')
  return { token_acceso, token_refresco: token_refresco ?? '' }
}

export function normalizarUsuario(r: Suelto): UsuarioActual {
  const u = (primero(r, 'usuario', 'user', 'datos', 'data') as Suelto) ?? r
  const roles = (primero(u, 'roles') as unknown[] | undefined) ?? [primero(u, 'rol', 'role')].filter(Boolean)
  return {
    usuario_id: Number(primero(u, 'usuario_id', 'usuarioId', 'id') ?? 0),
    nombre_usuario: String(primero(u, 'nombre_usuario', 'nombreUsuario', 'username', 'nombre') ?? ''),
    correo_electronico: String(primero(u, 'correo_electronico', 'correoElectronico', 'correo', 'email') ?? ''),
    roles: roles.map((x) => (typeof x === 'string' ? x : String(primero(x as Suelto, 'nombre', 'name', 'rol')))),
    entidad_administradora_id: (primero(u, 'entidad_administradora_id', 'entidadAdministradoraId', 'entidad_id') as number) ?? null,
  }
}

export async function iniciarSesion(datos: PeticionLogin) {
  const r = await pedir<Suelto>('/auth/login', { method: 'POST', cuerpo: datos, sinRenovar: true })
  return normalizarTokens(r)
}

export async function obtenerUsuarioActual() {
  return normalizarUsuario(await pedir<Suelto>('/auth/me'))
}

export function cerrarSesionApi(tokenRefresco: string | undefined) {
  return pedir<void>('/auth/logout', { method: 'POST', cuerpo: { token_refresco: tokenRefresco }, sinRenovar: true })
}

export function aSesion(u: UsuarioActual, alcance: Alcance): Sesion {
  return {
    usuarioId: u.usuario_id,
    nombreUsuario: u.nombre_usuario,
    correo: u.correo_electronico,
    roles: u.roles,
    alcance,
    entidadId: u.entidad_administradora_id,
  }
}
