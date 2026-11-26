# Cómo unificar el panel con lo de Joaquín

## Estructura del repo (F0-04)

```
API-webEco-reciclaje/
  api/     ← lo de Joaquín (Node + Express + TS: registro, login, verificación por correo)
  admin/   ← este panel (React + Vite + TS)
  db/      ← migraciones y semillas
```

Cada uno trabaja en su rama (`feat/api-auth` y `feat/admin-base`) y se integra a `main` por Pull Request.

## Pasos para conectar el panel a su API

1. Joaquín sube `api/` y levanta la API (por ejemplo, en `http://localhost:3000`).
2. En `admin/.env`:
   ```
   VITE_API_URL=http://localhost:3000
   VITE_API_SIMULADA=false
   ```
3. En la API, habilitar CORS para `http://localhost:5173` (variable `CORS_ORIGIN`).
4. Entrar al panel con un usuario que tenga rol de personal (`super_admin`, `admin_entidad`, `operador` o `administrador`).

## Lo único que hay que acordar con Joaquín

| Pregunta | Dónde se ajusta en el panel |
|---|---|
| ¿Las rutas van bajo `/api/v1`? | `src/config.ts` (`API_BASE`) |
| ¿Qué devuelve `POST /auth/login`? (nombres del token) | `normalizarTokens` en `src/services/auth.ts` (ya acepta `token_acceso`, `accessToken`, `token`, etc.) |
| ¿Existe `GET /auth/me` con los roles del usuario? | `normalizarUsuario` en `src/services/auth.ts` (acepta `roles[]`, `rol`, `user`, etc.) |
| ¿Existe `POST /auth/refresh`? | Si no existe, al vencer el token el panel simplemente vuelve al login |
| ¿Cómo se llaman los roles en la base? (`administrador` o `super_admin`…) | `ALCANCE_POR_ROL` en `src/services/auth.ts` |
| ¿Su pantalla de login es del panel o de la app? | Si es del panel (F4-02), su pantalla reemplaza a `src/pages/Login.tsx` y usa `useAuth().entrar(...)` |

## Qué se queda de cada uno

- **De Joaquín:** registro, login, verificación por correo y hash argon2id en la API (F2-03), y el login del panel (F4-02).
- **De este panel:** el proyecto base, el cliente HTTP con refresh, los tipos del contrato, el simulador MSW, el menú por rol y la pantalla de prueba (F4-01).
