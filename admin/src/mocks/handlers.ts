// Servidor simulado (MSW): imita la API según el contrato de F0-05,
// para que el panel avance en paralelo con la API real.
import { http, HttpResponse, delay } from 'msw'
import { API_BASE } from '../config'
import { ESTADOS_OPERATIVOS, type PuntoReciclaje, type UsuarioActual } from '../api/tipos'
import { CATEGORIAS, CONTRASENA_DEMO, ENTIDADES, PUNTOS, USUARIOS } from './datos'

const DURACION_ACCESO_MS = 15 * 60 * 1000

const errorApi = (estado: number, codigo: string, mensaje: string, detalles?: unknown) =>
  HttpResponse.json({ error: { codigo, mensaje, detalles } }, { status: estado })

// Tokens de mentira: "acceso.<usuario>.<vence>" y "refresco.<usuario>.<azar>".
// El simulador corre en la página, así que guarda los refrescos válidos en localStorage
// para sobrevivir a una recarga (la API real los guarda como hash en la tabla refresh_token).
const CLAVE_SIMULADOR = 'rebin_simulador_refrescos'
const refrescosValidos = {
  leer(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem(CLAVE_SIMULADOR) ?? '{}') } catch { return {} }
  },
  escribir(m: Record<string, number>) {
    try { localStorage.setItem(CLAVE_SIMULADOR, JSON.stringify(m)) } catch { /* sin almacenamiento */ }
  },
  get(t: string) { return this.leer()[t] },
  set(t: string, id: number) { this.escribir({ ...this.leer(), [t]: id }) },
  delete(t: string) { const m = this.leer(); delete m[t]; this.escribir(m) },
}

function emitirTokens(usuarioId: number) {
  const token_refresco = `refresco.${usuarioId}.${crypto.randomUUID()}`
  refrescosValidos.set(token_refresco, usuarioId)
  return { token_acceso: `acceso.${usuarioId}.${Date.now() + DURACION_ACCESO_MS}`, token_refresco }
}

function usuarioDelToken(request: Request): UsuarioActual | null {
  const [tipo, id, vence] = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').split('.')
  if (tipo !== 'acceso' || Number(vence) < Date.now()) return null
  return USUARIOS.find((u) => u.usuario_id === Number(id)) ?? null
}

const esPersonal = (u: UsuarioActual) =>
  u.roles.some((r) => ['super_admin', 'administrador', 'admin_entidad', 'operador', 'trabajador'].includes(r))

function paginar<T>(lista: T[], url: URL) {
  const pagina = Math.max(1, Number(url.searchParams.get('pagina') ?? 1))
  const por_pagina = Math.min(100, Math.max(1, Number(url.searchParams.get('por_pagina') ?? 20)))
  return {
    datos: lista.slice((pagina - 1) * por_pagina, pagina * por_pagina),
    paginacion: { pagina, por_pagina, total: lista.length },
  }
}

export const handlers = [
  // ---------- Autenticación ----------
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    await delay(400)
    const cuerpo = (await request.json().catch(() => ({}))) as { correo_electronico?: string; contrasena?: string }
    const u = USUARIOS.find((x) => x.correo_electronico === cuerpo.correo_electronico?.trim().toLowerCase())
    // Mismo mensaje si el correo no existe o la contraseña es incorrecta (no revelar cuál).
    if (!u || cuerpo.contrasena !== CONTRASENA_DEMO) {
      return errorApi(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.')
    }
    return HttpResponse.json(emitirTokens(u.usuario_id))
  }),

  http.post(`${API_BASE}/auth/refresh`, async ({ request }) => {
    const { token_refresco } = (await request.json().catch(() => ({}))) as { token_refresco?: string }
    const usuarioId = token_refresco ? refrescosValidos.get(token_refresco) : undefined
    if (!usuarioId) return errorApi(401, 'REFRESCO_INVALIDO', 'La sesión ya no es válida.')
    refrescosValidos.delete(token_refresco!) // rotativo: el anterior deja de servir
    return HttpResponse.json(emitirTokens(usuarioId))
  }),

  http.post(`${API_BASE}/auth/logout`, async ({ request }) => {
    const { token_refresco } = (await request.json().catch(() => ({}))) as { token_refresco?: string }
    if (token_refresco) refrescosValidos.delete(token_refresco)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${API_BASE}/auth/me`, ({ request }) => {
    const u = usuarioDelToken(request)
    if (!u) return errorApi(401, 'TOKEN_INVALIDO', 'Sesión no válida o vencida.')
    return HttpResponse.json(u)
  }),

  // ---------- Panel ----------
  http.get(`${API_BASE}/admin/categorias`, ({ request }) => {
    const u = usuarioDelToken(request)
    if (!u) return errorApi(401, 'TOKEN_INVALIDO', 'Sesión no válida o vencida.')
    return HttpResponse.json({ datos: CATEGORIAS })
  }),

  http.get(`${API_BASE}/admin/entidades`, ({ request }) => {
    const u = usuarioDelToken(request)
    if (!u) return errorApi(401, 'TOKEN_INVALIDO', 'Sesión no válida o vencida.')
    if (!u.roles.includes('super_admin')) return errorApi(403, 'SIN_PERMISO', 'No tienes permiso para ver entidades.')
    return HttpResponse.json(paginar(ENTIDADES, new URL(request.url)))
  }),

  http.get(`${API_BASE}/admin/puntos`, async ({ request }) => {
    await delay(300)
    const u = usuarioDelToken(request)
    if (!u) return errorApi(401, 'TOKEN_INVALIDO', 'Sesión no válida o vencida.')
    if (!esPersonal(u)) return errorApi(403, 'SIN_PERMISO', 'No tienes permiso para el panel.')

    const url = new URL(request.url)
    const p = url.searchParams
    const estado = p.get('estado_operativo')
    if (estado && !(ESTADOS_OPERATIVOS as readonly string[]).includes(estado)) {
      return errorApi(422, 'VALIDACION', 'Filtro inválido.', { estado_operativo: `Debe ser uno de: ${ESTADOS_OPERATIVOS.join(', ')}` })
    }

    let lista: PuntoReciclaje[] = PUNTOS
    // El alcance sale del usuario del token, nunca de la URL.
    if (u.roles.includes('admin_entidad')) lista = lista.filter((x) => x.entidad_administradora_id === u.entidad_administradora_id)
    if (estado) lista = lista.filter((x) => x.estado_operativo === estado)
    if (p.get('comuna')) lista = lista.filter((x) => x.comuna === p.get('comuna'))
    if (p.get('categoria_residuo_id')) {
      const id = Number(p.get('categoria_residuo_id'))
      lista = lista.filter((x) => x.categorias.some((c) => c.categoria_residuo_id === id))
    }
    const buscar = p.get('buscar')?.toLowerCase()
    if (buscar) lista = lista.filter((x) => `${x.nombre} ${x.direccion}`.toLowerCase().includes(buscar))

    const orden = p.get('orden') ?? 'nombre'
    const campo = orden.replace(/^-/, '') as keyof PuntoReciclaje
    const signo = orden.startsWith('-') ? -1 : 1
    lista = [...lista].sort((a, b) => String(a[campo]).localeCompare(String(b[campo]), 'es') * signo)

    return HttpResponse.json(paginar(lista, url))
  }),
]
