// Cliente HTTP único del panel. Ninguna pantalla usa fetch directo.
// - Agrega el token de acceso.
// - Si la API responde 401, intenta renovar UNA vez con el token de refresco y repite la petición.
// - Si no se puede renovar, avisa al AuthContext para que lleve al login.
import { API_BASE } from '../config'
import type { RespuestaTokens } from '../api/tipos'

export class ErrorApi extends Error {
  estado: number
  codigo: string
  detalles?: unknown

  constructor(estado: number, codigo: string, mensaje: string, detalles?: unknown) {
    super(mensaje)
    this.estado = estado
    this.codigo = codigo
    this.detalles = detalles
  }
}

// ---------- Tokens ----------
// El token de acceso vive solo en memoria. El de refresco se guarda en sessionStorage
// (o localStorage si se marca "mantener sesión"). La política final la define F4-02.
const CLAVE_REFRESCO = 'rebin_panel_refresco'
let tokenAcceso: string | null = null
let alExpirarSesion: (() => void) | null = null

export function registrarAlExpirarSesion(fn: () => void) {
  alExpirarSesion = fn
}

export function guardarTokens(tokens: RespuestaTokens | null, recordar = false) {
  tokenAcceso = tokens?.token_acceso ?? null
  try {
    localStorage.removeItem(CLAVE_REFRESCO)
    sessionStorage.removeItem(CLAVE_REFRESCO)
    if (tokens?.token_refresco) (recordar ? localStorage : sessionStorage).setItem(CLAVE_REFRESCO, tokens.token_refresco)
  } catch {
    /* almacenamiento bloqueado: la sesión vive solo mientras la pestaña esté abierta */
  }
}

export function leerTokenRefresco(): { token: string; recordar: boolean } | null {
  try {
    const local = localStorage.getItem(CLAVE_REFRESCO)
    if (local) return { token: local, recordar: true }
    const sesion = sessionStorage.getItem(CLAVE_REFRESCO)
    return sesion ? { token: sesion, recordar: false } : null
  } catch {
    return null
  }
}

// Si varias peticiones reciben 401 a la vez, todas esperan la misma renovación.
let renovacionEnCurso: Promise<boolean> | null = null

export function renovarSesion(): Promise<boolean> {
  if (!renovacionEnCurso) {
    renovacionEnCurso = (async () => {
      const guardado = leerTokenRefresco()
      if (!guardado) return false
      try {
        const r = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ token_refresco: guardado.token }),
        })
        if (!r.ok) return false
        const { normalizarTokens } = await import('./auth')
        const nuevos = normalizarTokens(await r.json())
        // Si la API no rota el refresco, se conserva el anterior.
        guardarTokens({ ...nuevos, token_refresco: nuevos.token_refresco || guardado.token }, guardado.recordar)
        return true
      } catch {
        return false
      }
    })().finally(() => {
      renovacionEnCurso = null
    })
  }
  return renovacionEnCurso
}

// ---------- Peticiones ----------
type Consulta = Record<string, string | number | boolean | undefined | null>

export interface OpcionesPedir extends Omit<RequestInit, 'body'> {
  cuerpo?: unknown
  consulta?: Consulta
  sinRenovar?: boolean
}

function armarUrl(ruta: string, consulta?: Consulta) {
  const url = new URL(`${API_BASE}${ruta}`)
  for (const [k, v] of Object.entries(consulta ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  return url.toString()
}

export async function pedir<T>(ruta: string, opciones: OpcionesPedir = {}): Promise<T> {
  const { cuerpo, consulta, sinRenovar, ...init } = opciones
  const hacer = () => {
    const cabeceras = new Headers(init.headers)
    cabeceras.set('Accept', 'application/json')
    if (cuerpo !== undefined) cabeceras.set('Content-Type', 'application/json')
    if (tokenAcceso) cabeceras.set('Authorization', `Bearer ${tokenAcceso}`)
    return fetch(armarUrl(ruta, consulta), {
      ...init,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    })
  }

  let respuesta: Response
  try {
    respuesta = await hacer()
    if (respuesta.status === 401 && !sinRenovar && (await renovarSesion())) {
      respuesta = await hacer()
    }
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con la API. ¿Está encendida?')
  }

  if (respuesta.status === 204) return undefined as T
  const datos = await respuesta.json().catch(() => null)

  if (!respuesta.ok) {
    // Forma de error acordada en F0-05: { error: { codigo, mensaje, detalles } }
    const err = datos?.error ?? {}
    if (respuesta.status === 401 && !sinRenovar) alExpirarSesion?.()
    throw new ErrorApi(
      respuesta.status,
      err.codigo ?? `HTTP_${respuesta.status}`,
      err.mensaje ?? 'Ocurrió un error inesperado.',
      err.detalles,
    )
  }
  return datos as T
}
