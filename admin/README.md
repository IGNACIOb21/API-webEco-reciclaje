# Rebin v2 · Panel de administración (`admin/`)

Tarjeta **F4-01 · Proyecto React del panel y cliente de la API**.
React + Vite + TypeScript, React Router, TanStack Query y un servidor simulado (MSW) para avanzar sin esperar la API.

## Cómo correrlo

```bash
cd admin
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

| Variable | Para qué |
|---|---|
| `VITE_API_URL` | URL de la API, sin `/api/v1` (por ejemplo, `http://localhost:3000`) |
| `VITE_API_SIMULADA` | `true` = responde el simulador (MSW) con datos falsos · `false` = API real |

> Nunca poner secretos en el `.env` del panel: todo lo que empieza con `VITE_` termina en el navegador.

### Usuarios del simulador (contraseña `rebin1234`)

| Correo | Rol (F0-03) | Qué ve |
|---|---|---|
| `superadmin@rebin.cl` | super_admin | Todo |
| `entidad@rebin.cl` | admin_entidad | Solo lo de su entidad (8 de 38 puntos) |
| `operador@rebin.cl` | operador | Resumen, Reportes y Depósitos |
| `ciudadano@rebin.cl` | ciudadano | No entra al panel |

## Checklist de F4-01

- [x] Proyecto React + Vite + TypeScript con enrutador (React Router) y TanStack Query
- [ ] Librería de UI: **por decidir** (por ahora, CSS propio con los colores de Rebin)
- [x] Cliente HTTP único (`src/services/api.ts`): agrega el token, **renueva con el refresh** si recibe 401 y, si no puede, lleva al login
- [x] Tipos del contrato (`src/api/tipos.ts`), con los enums reales de F0-01 y los roles de F0-03
- [x] Servidor simulado MSW (`src/mocks/`) con datos falsos que respetan el contrato de F0-05
- [x] Variables de entorno; sin secretos en el front
- [x] **Listo cuando:** el panel arranca y una pantalla de prueba lee datos del simulador → **Puntos de reciclaje** (filtros, orden y paginación)

## Contrato que asume el panel (F0-05)

Rutas bajo `/api/v1`; las del panel, bajo `/api/v1/admin/...`.

| Endpoint | Envía | Responde |
|---|---|---|
| `POST /auth/login` | `{ correo_electronico, contrasena }` | `{ token_acceso, token_refresco }` |
| `POST /auth/refresh` | `{ token_refresco }` | `{ token_acceso, token_refresco }` (rotativo) |
| `POST /auth/logout` | `{ token_refresco }` | `204` |
| `GET /auth/me` | Bearer | `{ usuario_id, nombre_usuario, correo_electronico, roles[], entidad_administradora_id }` |
| `GET /admin/puntos` | `?pagina&por_pagina&orden&buscar&estado_operativo&comuna&categoria_residuo_id` | `{ datos[], paginacion: { pagina, por_pagina, total } }` |
| `GET /admin/categorias` | Bearer | `{ datos[] }` |

- Errores: `{ error: { codigo, mensaje, detalles } }`, con los códigos 401, 403, 404, 409, 422 y 429.
- Fechas en ISO 8601 UTC. El panel las muestra en hora de Chile.
- ⚠️ **Los campos de cada recurso son provisionales.** Hay que ajustarlos a `docs/esquema.md` y `docs/api.yaml` cuando estén en el repositorio.

## Estructura

```
src/
  config.ts              variables de entorno
  api/tipos.ts           tipos del contrato (F0-05) y enums (F0-01)
  api/consultas.ts       hooks de TanStack Query (usePuntos, useCategorias)
  services/api.ts        cliente HTTP único: token, refresh, errores
  services/auth.ts       login, /auth/me, roles → alcance
  auth/AuthContext.tsx   estado de la sesión
  components/            RutaProtegida
  layout/                barra lateral y pestañas por rol
  pages/                 Login, Resumen, Puntos (prueba) y "en construcción"
  mocks/                 servidor simulado MSW y datos falsos
```

## Relación con otras tarjetas

- **F4-02 (Login, sesión y rutas por rol, de Joaquín):** aquí hay un login **provisorio sin diseño** (`src/pages/Login.tsx`), solo para poder probar el panel. Su pantalla de login lo reemplaza y llama a `useAuth().entrar(correo, contrasena, recordar)`. Quedan pendientes para F4-02: recuperar contraseña, la pantalla de 403, la política final de almacenamiento del token y la matriz oficial de F0-03.
- **F4-03:** ya existe el tema visual (colores y tipografías de Rebin) y una tabla básica. Faltan los componentes reutilizables y la guía visual.
- **F4-04:** ya están el menú por rol y las pantallas "en construcción". Falta conectarlo a la API real.
