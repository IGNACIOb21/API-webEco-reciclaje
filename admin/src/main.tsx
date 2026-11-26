import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { API_SIMULADA } from './config'
import { ErrorApi } from './services/api'

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // No reintentar errores del cliente (401, 403, 404, 422…); sí los de red o servidor.
      retry: (intentos, error) =>
        !(error instanceof ErrorApi && error.estado >= 400 && error.estado < 500) && intentos < 2,
    },
  },
})

async function iniciar() {
  if (API_SIMULADA) {
    const { worker } = await import('./mocks/navegador')
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={clienteConsultas}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void iniciar()
