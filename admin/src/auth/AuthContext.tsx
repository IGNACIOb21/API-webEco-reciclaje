import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ErrorApi, guardarTokens, leerTokenRefresco, registrarAlExpirarSesion, renovarSesion } from '../services/api'
import { aSesion, alcanceDe, cerrarSesionApi, iniciarSesion, obtenerUsuarioActual, type Sesion } from '../services/auth'

interface ValorAuth {
  sesion: Sesion | null
  cargando: boolean
  aviso: string | null
  entrar: (correo: string, contrasena: string, recordar: boolean) => Promise<void>
  salir: (aviso?: string) => void
}

const AuthContext = createContext<ValorAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)

  const salir = useCallback((motivo?: string) => {
    const refresco = leerTokenRefresco()?.token
    if (refresco) void cerrarSesionApi(refresco).catch(() => undefined)
    guardarTokens(null)
    setSesion(null)
    setAviso(motivo ?? null)
  }, [])

  // Pregunta a la API quién es y valida que sea personal del panel.
  const cargarSesion = useCallback(async () => {
    const usuario = await obtenerUsuarioActual()
    const alcance = alcanceDe(usuario.roles)
    if (!alcance) {
      throw new ErrorApi(403, 'SIN_ACCESO_PANEL',
        'Tu cuenta no tiene permisos para el panel. Es solo para el personal de Rebin.')
    }
    setSesion(aSesion(usuario, alcance))
  }, [])

  // Al abrir el panel: si hay token de refresco guardado, intenta recuperar la sesión.
  useEffect(() => {
    registrarAlExpirarSesion(() => {
      guardarTokens(null)
      setSesion(null)
      setAviso('Tu sesión expiró. Vuelve a iniciar sesión.')
    })
    ;(async () => {
      try {
        if (leerTokenRefresco() && (await renovarSesion())) await cargarSesion()
      } catch {
        guardarTokens(null)
      } finally {
        setCargando(false)
      }
    })()
  }, [cargarSesion])

  const entrar = useCallback(async (correo: string, contrasena: string, recordar: boolean) => {
    setAviso(null)
    const tokens = await iniciarSesion({ correo_electronico: correo, contrasena })
    guardarTokens(tokens, recordar)
    try {
      await cargarSesion()
    } catch (e) {
      salir()
      throw e
    }
  }, [cargarSesion, salir])

  return (
    <AuthContext.Provider value={{ sesion, cargando, aviso, entrar, salir }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
