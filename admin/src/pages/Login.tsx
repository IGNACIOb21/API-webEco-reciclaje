// Login PROVISORIO, solo para poder probar el panel.
// El login real del panel es la tarjeta F4-02 (Joaquín): su pantalla reemplaza a esta
// y solo tiene que llamar a useAuth().entrar(correo, contrasena, recordar).
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { API_SIMULADA } from '../config'

export function Login() {
  const { sesion, entrar, aviso } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (sesion) return <Navigate to="/" replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await entrar(correo.trim(), contrasena, false)
      navegar((ubicacion.state as { desde?: string } | null)?.desde ?? '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} style={{ padding: 20 }}>
      <h2>Login (provisorio)</h2>
      {aviso && <p>{aviso}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>
        <label>Correo<br />
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </label>
      </p>
      <p>
        <label>Contraseña<br />
          <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
        </label>
      </p>
      <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      {API_SIMULADA && (
        <p>
          Usuarios de prueba (contraseña rebin1234): superadmin@rebin.cl, entidad@rebin.cl,
          operador@rebin.cl, ciudadano@rebin.cl
        </p>
      )}
    </form>
  )
}
