import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RutaProtegida } from './components/RutaProtegida'
import { PanelLayout } from './layout/PanelLayout'
import { SECCIONES } from './layout/secciones'
import { EnConstruccion } from './pages/EnConstruccion'
import { Login } from './pages/Login'
import { Puntos } from './pages/Puntos'
import { Resumen } from './pages/Resumen'

// Pantallas ya construidas; el resto muestra "en construcción".
const PANTALLAS: Record<string, React.ReactNode> = {
  '/puntos': <Puntos />,
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RutaProtegida><PanelLayout /></RutaProtegida>}>
            <Route index element={<Resumen />} />
            {SECCIONES.filter((s) => s.ruta !== '/').map((s) => (
              <Route key={s.ruta} path={s.ruta.slice(1)}
                element={<RutaProtegida alcances={s.alcances}>{PANTALLAS[s.ruta] ?? <EnConstruccion seccion={s} />}</RutaProtegida>} />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
