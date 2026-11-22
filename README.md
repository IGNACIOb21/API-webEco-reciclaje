# Rebin v2 — API base

API en desarrollo para consultar y administrar puntos de reciclaje con Node.js, Express, TypeScript y Supabase. El panel admite el entorno local ficticio y el proyecto compartido cuando se habilita expresamente. La aplicación móvil usa Supabase y su integración directa con esta API está pendiente de comprobar.

## Empezar: consultar los datos del equipo

Necesitas Node.js 20.19 o superior. El archivo `.env.example` incluye la URL y la clave publicable del proyecto Supabase del equipo. Ejecuta estos comandos en la carpeta de la API:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

El nuevo archivo `.env` contiene la conexión al proyecto compartido. Conserva `REBIN_ESCRITURAS_COMPARTIDAS=false` para comenzar con consultas. No necesitas contraseña de PostgreSQL para usar la Data API. Si ya tienes un `.env`, no se reemplaza: revisa su configuración existente.

Después, inicia el servidor:

```powershell
npm run dev
```

Mantén la terminal abierta y visita:

- `http://localhost:3000/api/v1/salud` para comprobar la conexión.
- `http://localhost:3000/api/v1/puntos` para consultar puntos.
- `http://localhost:3000/api/v1/materiales` para consultar materiales.
- `http://localhost:3000/api/v1/entidades` para consultar entidades.

Estas consultas no modifican puntos. Para probar el panel y las operaciones de administración sin afectar los datos del equipo, sigue el apartado de datos ficticios. No subas archivos `.env` ni credenciales a GitHub.

## Panel con datos compartidos

Para administrar la base compartida desde este computador, configura el proyecto autorizado en `.env`, activa `REBIN_ESCRITURAS_COMPARTIDAS=true` y conserva `REBIN_HOST=127.0.0.1`. Inicia la API con `npm run dev` y abre `http://localhost:3000/panel`. Inicia sesión con una cuenta administradora activa para habilitar las acciones. Los cambios afectan los datos compartidos y pueden reflejarse en la aplicación móvil. El panel compartido solo se sirve en localhost y no está preparado para publicarse en internet.

## Probar con datos ficticios

Esta opción utiliza una base de Supabase local separada. Requiere Node.js 20.19 o superior, npm y Docker Desktop funcionando. No ejecuta migraciones contra el proyecto compartido.

1. Instala las dependencias con `npm ci`.
2. Crea una vez una red local de Docker:

   ```powershell
   docker network create -o "com.docker.network.bridge.host_binding_ipv4=127.0.0.1" rebin-pruebas-local
   ```

3. Inicia Supabase local con `npx supabase start --network-id rebin-pruebas-local`. La primera vez descarga imágenes. Configura Docker Desktop para publicar los puertos solo en localhost y comprueba los puertos antes de continuar.
4. Copia `.env.pruebas.example` a `.env.pruebas`. Sustituye el marcador de la clave por la clave **publishable** de la instancia local, que aparece en la salida de `supabase start`. No copies ni compartas la clave **secret**.
5. Solo para preparar una base local nueva y vacía, ejecuta estos comandos en orden:

   ```powershell
   npm run preparar:base-local
   npm run preparar:operaciones-locales
   npm run preparar:operaciones-locales-v2
   npm run preparar:operaciones-locales-v3
   npm run preparar:admin-local
   ```

6. Ejecuta `npm run dev:pruebas` y abre `http://localhost:3001/panel`. Mantén la terminal abierta mientras uses el panel.

Para ejecuciones posteriores, inicia Docker y Supabase local, ejecuta `npm run dev:pruebas` y abre el panel; no repitas los comandos de preparación sobre una base que ya contiene datos.

## Configuración y arranque

1. Usa la URL y la clave publicable incluidas en `.env.example` para el proyecto del equipo. No compartas ni publiques ninguna clave secreta.
2. Crea tu `.env` local a partir de `.env.example`. Las variables antiguas de Prisma no se usan.
3. Ejecuta `npm install` y luego `npm run dev`. El puerto predeterminado es 3000.
4. Abre `http://localhost:3000/api/v1/salud`.

La comprobación intenta leer como máximo una fila de `punto_reciclaje` mediante la Data API y nunca devuelve esa fila al usuario. No escribe datos. Si el acceso funciona, responde 200 con `estado: ok` y `base_datos: conectada`; si no, responde 503 con `estado: error` y `base_datos: desconectada`. Un 503 puede significar configuración ausente o incorrecta, problemas de red, tabla no expuesta o permisos/RLS insuficientes; por sí solo no demuestra que PostgreSQL esté caído. No cambies permisos ni expongas tablas sin acordarlo con el equipo.

`GET /api/v1/puntos` consulta los campos públicos de la tabla de puntos y devuelve hasta 25 filas por página. Se pueden usar `?pagina=1&limite=10`; el límite máximo es 100. La ruta no requiere sesión y devuelve los estados existentes, incluidos los puntos fuera de servicio. Es de solo lectura y respeta los permisos de la clave publicable y las políticas de Supabase.

`GET /api/v1/puntos/:id` consulta un punto por su identificador. Un identificador inválido responde 400 y uno inexistente o no visible responde 404.

`GET /api/v1/puntos/:id/materiales` devuelve los materiales asociados al punto; un punto sin materiales devuelve una lista vacía.

`GET /api/v1/materiales` consulta el catálogo público de categorías de residuo, con un máximo de 100 resultados ordenados por nombre. No modifica datos.

`GET /api/v1/entidades` consulta los identificadores, nombres y tipos de entidades administradoras. En la base real se requiere una entidad para cada punto.

## Organización

Las rutas, controladores, servicios y repositorios están en `src/`. El manejo global de errores vive en `src/server.ts`. Para compilar, ejecuta `npm run build`; para iniciar la compilación, `npm start`.

`npm test` ejecuta comprobaciones automáticas contra respuestas simuladas: no se conecta a Supabase ni modifica datos. Estas pruebas no sustituyen una base de desarrollo para verificar escrituras y permisos reales.

## Entorno local de pruebas

La configuración en `supabase/` corresponde a una instancia local independiente; no está vinculada al proyecto compartido. `pruebas/estructura-local.sql` contiene un esquema mínimo con datos ficticios, no es el esquema oficial completo ni una migración de producción. `npm run preparar:base-local` solo se conecta a PostgreSQL en `127.0.0.1:54322` y se niega a actuar si ya existen tablas públicas; nunca lee `DATABASE_URL`.

Para iniciar la API contra Supabase local, configura `.env.pruebas` a partir de `.env.pruebas.example` con la URL y clave publicable locales y ejecuta `npm run dev:pruebas`. El proceso comprueba que la URL apunte al puerto local 54321 y usa el puerto 3001 para la API, separado del 3000 habitual. Conserva la configuración de producción en `.env`. No coloques datos reales ni claves de producción en las pruebas.

El panel personal de prueba está en `http://localhost:3001/panel`. Consulta y modifica datos mediante la API local; usa la cuenta ficticia de `.env.admin-local` para las operaciones autorizadas. El inicio de sesión automático se deshabilita cuando la API no apunta al entorno de pruebas. No publicar ni reutilizar la cuenta ficticia en producción.

`npm run preparar:admin-local` crea una cuenta administradora ficticia solo para Supabase local y guarda su credencial generada en `.env.admin-local`, un archivo ignorado por Git. No compartas ni reutilices esa credencial fuera de las pruebas. Si el archivo ya existe, el comando no lo reemplaza. `npm run probar:alta-local` inicia una API temporal con destino estrictamente local, inicia sesión con esa cuenta y crea un punto ficticio con dos materiales; cada ejecución exitosa deja un nuevo punto de prueba en la base local para poder consultarlo.

Para los puntos generados por esa prueba se puede ejecutar `npm run probar:estado-local -- ID desactivar` o `npm run probar:estado-local -- ID reactivar`. El comando comprueba que el destino sea local y que el punto tenga el nombre de ejemplo antes de cambiarlo.

`POST /api/v1/puntos` crea un punto con sus materiales, `POST /api/v1/puntos/:id/desactivar` lo marca fuera de servicio y `POST /api/v1/puntos/:id/reactivar` vuelve a dejarlo operativo. Requieren sesión de administrador: la API y las funciones SQL comprueban el rol. En el proyecto compartido las escrituras solo se permiten si se configura expresamente `REBIN_ESCRITURAS_COMPARTIDAS=true` y el destino es exactamente el proyecto esperado. Las funciones `prueba_*` son exclusivas del esquema ficticio local.

Ejemplo de cuerpo para crear un punto local:

```json
{ "nombre_punto": "Punto de prueba", "direccion_completa": "Dirección ficticia 123", "comuna": "Santiago", "coordenada_latitud": -33.45, "coordenada_longitud": -70.65, "entidad_administradora_id": 1, "materiales": [1, 2] }
```

`materiales` contiene los identificadores de categorías devueltos por `GET /api/v1/materiales`; la entidad se obtiene de `GET /api/v1/entidades`. El alta del punto y sus asociaciones se realizan juntas en la base; se rechazan entidades inexistentes y materiales repetidos o inexistentes.

`npm run test:local` crea cuentas y un punto ficticios en Supabase local para probar autenticación, permisos y escrituras; después elimina los datos temporales que creó. Requiere Supabase local iniciado y las operaciones de prueba. En un entorno local nuevo, ejecuta `npm run preparar:base-local`, `npm run preparar:operaciones-locales`, `npm run preparar:operaciones-locales-v2` y `npm run preparar:operaciones-locales-v3` en ese orden. Estos scripts apuntan al servidor de base de datos en `127.0.0.1:54322` y no usan `DATABASE_URL`.

`npm run test:contrato-local` comprueba las funciones de asignación de rol, gestión de puntos y filtrado del mapa en una transacción local que se revierte al terminar. Las versiones revisadas se aplicaron al proyecto compartido el 21 de noviembre de 2026. `scripts/aplicar-cambios-compartidos.cjs` conserva la herramienta utilizada para la activación; no debe ejecutarse nuevamente sin revisar el estado actual de la base.

Antes de usar Supabase local, comprueba con Docker que sus puertos publicados estén limitados a `127.0.0.1` o `[::1]`. Cuando termines, `npx supabase stop` detiene el entorno local conservando sus datos; no uses `--no-backup` salvo que quieras eliminarlos.

El esquema anterior `prisma/schema.prisma` se conserva solo como borrador histórico; no representa necesariamente la base real y no se usa ni se sincroniza. En la base compartida ya se instalaron las funciones de administración, se asignó un rol y se ajustó la consulta del mapa con autorización; no se modificaron puntos existentes durante esa activación.

## Verificación de administrador

`POST /api/v1/auth/login` recibe `{ "email": "...", "password": "..." }` y entrega tokens de Supabase solo si la cuenta es administradora activa; `POST /api/v1/auth/refrescar` recibe `{ "refresh_token": "..." }` y vuelve a verificar el rol. Las respuestas incluyen `Cache-Control: no-store`. `npm run verificar:acceso` solicita las credenciales en la terminal, sin mostrar la contraseña, para verificar el acceso sin cambiar puntos. No envíes contraseñas o tokens en URLs ni en registros; fuera de localhost, protege el transporte con HTTPS. Por defecto la API escucha solo en `127.0.0.1`.

`GET /api/v1/admin/me` requiere `Authorization: Bearer <access_token>` de Supabase Auth. La API verifica el token con `auth.getUser`, rechaza usuarios anónimos, consulta el usuario activo por `auth_id` y comprueba el rol `administrador` en `usuario_rol` y `rol` usando la sesión del solicitante. Devuelve 200 si cumple, 401 si falta la sesión o es inválida, 403 si no está autorizado y 503 si no puede comprobarlo.

La inspección confirmó que las dos cuentas administradoras existentes usan contraseñas propias y no tienen `auth_id` de Supabase. La nueva API usa Supabase Auth; se autorizó la cuenta de Kevin sin modificar esas cuentas existentes. También se actualizó `app_puntos_cercanos` para excluir los puntos fuera de servicio. No se modificaron puntos existentes durante la activación.
