// Configuración leída de las variables de entorno (.env). Nunca poner secretos aquí:
// todo lo que empieza con VITE_ termina dentro del JavaScript que descarga el navegador.
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const API_BASE = `${API_URL}/api/v1`
// true = el servidor simulado (MSW) responde en lugar de la API real.
export const API_SIMULADA = import.meta.env.VITE_API_SIMULADA === 'true'
