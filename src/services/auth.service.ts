import crypto from 'node:crypto';
import argon2 from 'argon2';
import type pg from 'pg';
import { config } from '../config.js';
import { pool, transaccion, type Consulta } from '../db.js';
import { conflicto, ErrorApi, noAutenticado, noEncontrado, prohibido } from '../lib/errors.js';
import { firmarAcceso, generarRefresh, hashRefresh } from '../lib/tokens.js';
import { enviarCodigoVerificacion } from '../lib/correo.js';
import type { LoginInput, RegistroInput, VerificarInput } from '../validators/auth.js';

// argon2id con los parámetros recomendados por OWASP (19 MiB, 2 pasadas, 1 hilo).
const OPCIONES_ARGON = { type: argon2.argon2id as 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Hash falso para gastar el mismo tiempo cuando el correo no existe (evita adivinar correos por tiempo de respuesta).
let hashFalso: Promise<string> | undefined;
const obtenerHashFalso = () => (hashFalso ??= argon2.hash('contrasena-falsa-rebin', OPCIONES_ARGON));

export interface Sesion {
  token_type: 'Bearer';
  access_token: string;
  expires_in: number; // segundos
  refresh_token: string;
}

export interface UsuarioPublico {
  usuario_id: number;
  nombre_usuario: string;
  correo_electronico: string | null;
  roles: string[];
}

async function rolesDe(db: Consulta, usuarioId: number): Promise<string[]> {
  const r = await db.query<{ nombre: string }>(
    `SELECT r.nombre FROM usuario_rol ur JOIN rol r ON r.rol_id = ur.rol_id
      WHERE ur.usuario_id = $1 ORDER BY r.nombre`,
    [usuarioId],
  );
  return r.rows.map((x) => x.nombre);
}

/** Crea un refresh token (guardando solo su hash) y firma el token de acceso. */
async function emitirSesion(
  db: Consulta,
  usuarioId: number,
  opciones: { familiaId?: string; dispositivo?: string | undefined } = {},
): Promise<Sesion> {
  const roles = await rolesDe(db, usuarioId);
  const refresh = generarRefresh();
  const expira = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.query(
    `INSERT INTO refresh_token (usuario_id, familia_id, token_hash, expira_en, identificador_dispositivo)
     VALUES ($1, $2, $3, $4, $5)`,
    [usuarioId, opciones.familiaId ?? crypto.randomUUID(), refresh.hash, expira, opciones.dispositivo ?? null],
  );
  return {
    token_type: 'Bearer',
    access_token: firmarAcceso(usuarioId, roles),
    expires_in: config.ACCESS_TOKEN_TTL_MIN * 60,
    refresh_token: refresh.token,
  };
}

// ---------- Verificación de correo ----------
const CODIGO_MINUTOS = 15;
const MAX_INTENTOS = 5;
const ESPERA_REENVIO_S = 60;

const hashCodigo = (usuarioId: number, codigo: string) =>
  crypto.createHmac('sha256', config.JWT_SECRET).update(`${usuarioId}:${codigo}`).digest('hex');

/** Crea un código de 6 dígitos (anula los anteriores). Se guarda solo su hash; el envío va después. */
async function crearCodigo(db: Consulta, usuarioId: number): Promise<string> {
  const codigo = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await db.query('UPDATE codigo_verificacion SET usado = true WHERE usuario_id = $1 AND NOT usado', [usuarioId]);
  await db.query(
    `INSERT INTO codigo_verificacion (usuario_id, codigo_hash, expira_en)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [usuarioId, hashCodigo(usuarioId, codigo), CODIGO_MINUTOS],
  );
  return codigo;
}

async function enviarCodigo(correo: string, nombre: string, codigo: string): Promise<boolean> {
  try {
    await enviarCodigoVerificacion(correo, nombre, codigo, CODIGO_MINUTOS);
    return true;
  } catch (err) {
    console.error('No se pudo enviar el correo de verificación:', (err as Error).message);
    return false;
  }
}

export interface RegistroRespuesta {
  correo_electronico: string;
  codigo_enviado: boolean;
  codigo_valido_minutos: number;
  reenvio_en_segundos: number;
}

/** Crea la cuenta SIN verificar y envía el código. La sesión se entrega recién al verificar el correo. */
export async function registrar(input: RegistroInput): Promise<RegistroRespuesta> {
  const porCorreo = await pool.query<{ verificado: boolean }>(
    'SELECT correo_verificado_en IS NOT NULL AS verificado FROM usuario WHERE lower(correo_electronico) = $1',
    [input.correo_electronico],
  );
  if (porCorreo.rows[0]) {
    throw porCorreo.rows[0].verificado
      ? conflicto('CORREO_EN_USO', 'Ese correo ya está registrado')
      : conflicto('CORREO_SIN_VERIFICAR', 'Ese correo ya tiene una cuenta pendiente de verificación');
  }
  const porNombre = await pool.query('SELECT 1 FROM usuario WHERE lower(nombre_usuario) = lower($1)', [
    input.nombre_usuario,
  ]);
  if (porNombre.rowCount) throw conflicto('NOMBRE_USUARIO_EN_USO', 'Ese nombre de usuario ya está en uso');

  const hash = await argon2.hash(input.contrasena, OPCIONES_ARGON);

  try {
    const { codigo } = await transaccion(async (c) => {
      const u = await c.query<{ usuario_id: number }>(
        `INSERT INTO usuario (nombre_usuario, correo_electronico, contrasena_hash)
         VALUES ($1, $2, $3) RETURNING usuario_id`,
        [input.nombre_usuario, input.correo_electronico, hash],
      );
      const usuarioId = u.rows[0]!.usuario_id;

      // Todo usuario nuevo recibe el rol base "ciudadano".
      const rol = await c.query(
        `INSERT INTO usuario_rol (usuario_id, rol_id)
         SELECT $1, rol_id FROM rol WHERE nombre = 'ciudadano'`,
        [usuarioId],
      );
      if (rol.rowCount !== 1) {
        throw new Error("Falta el rol 'ciudadano' en la tabla rol. Ejecuta db/migrations/0002_login.sql");
      }
      return { codigo: await crearCodigo(c, usuarioId) };
    });

    // El correo se envía con la transacción ya confirmada. Si falla, la cuenta queda y se puede reenviar.
    const enviado = await enviarCodigo(input.correo_electronico, input.nombre_usuario, codigo);
    return {
      correo_electronico: input.correo_electronico,
      codigo_enviado: enviado,
      codigo_valido_minutos: CODIGO_MINUTOS,
      reenvio_en_segundos: ESPERA_REENVIO_S,
    };
  } catch (err) {
    // Carrera: dos registros simultáneos con el mismo correo. La restricción UNIQUE de la base gana.
    if ((err as pg.DatabaseError).code === '23505') {
      throw conflicto('CORREO_EN_USO', 'Ese correo ya está registrado');
    }
    throw err;
  }
}

/** Comprueba el código. Si es correcto, marca el correo como verificado y entrega la sesión. */
export async function verificarCorreo(
  input: VerificarInput,
): Promise<{ usuario: UsuarioPublico; sesion: Sesion }> {
  const r = await transaccion(async (c) => {
    const u = await c.query<{
      usuario_id: number;
      nombre_usuario: string;
      correo_electronico: string | null;
      activo: boolean | null;
      verificado: boolean;
    }>(
      `SELECT usuario_id, nombre_usuario, correo_electronico, activo,
              correo_verificado_en IS NOT NULL AS verificado
         FROM usuario WHERE lower(correo_electronico) = $1 FOR UPDATE`,
      [input.correo_electronico],
    );
    const usr = u.rows[0];
    if (!usr) return { error: 'incorrecto' as const, restantes: 0 }; // mismo mensaje que un código malo
    if (usr.verificado) return { error: 'ya_verificado' as const };
    if (!usr.activo) return { error: 'desactivada' as const };

    const k = await c.query<{ codigo_verificacion_id: number; codigo_hash: string; intentos: number }>(
      `SELECT codigo_verificacion_id, codigo_hash, intentos FROM codigo_verificacion
        WHERE usuario_id = $1 AND NOT usado AND expira_en > now()
        ORDER BY creado_en DESC LIMIT 1 FOR UPDATE`,
      [usr.usuario_id],
    );
    const cod = k.rows[0];
    if (!cod) return { error: 'vencido' as const };
    if (cod.intentos >= MAX_INTENTOS) return { error: 'bloqueado' as const };

    const correcto = crypto.timingSafeEqual(
      Buffer.from(cod.codigo_hash, 'hex'),
      Buffer.from(hashCodigo(usr.usuario_id, input.codigo), 'hex'),
    );
    if (!correcto) {
      await c.query('UPDATE codigo_verificacion SET intentos = intentos + 1 WHERE codigo_verificacion_id = $1', [
        cod.codigo_verificacion_id,
      ]);
      return { error: 'incorrecto' as const, restantes: MAX_INTENTOS - cod.intentos - 1 };
    }

    await c.query('UPDATE codigo_verificacion SET usado = true WHERE codigo_verificacion_id = $1', [
      cod.codigo_verificacion_id,
    ]);
    await c.query('UPDATE usuario SET correo_verificado_en = now() WHERE usuario_id = $1', [usr.usuario_id]);
    const sesion = await emitirSesion(c, usr.usuario_id, { dispositivo: input.identificador_dispositivo });
    return {
      usuario: {
        usuario_id: usr.usuario_id,
        nombre_usuario: usr.nombre_usuario,
        correo_electronico: usr.correo_electronico,
        roles: await rolesDe(c, usr.usuario_id),
      },
      sesion,
    };
  }); // los intentos fallidos se confirman: por eso los errores se lanzan DESPUÉS de la transacción

  if (r.sesion && r.usuario) return { usuario: r.usuario, sesion: r.sesion };
  const restantes = r.restantes ?? 0;
  switch (r.error) {
    case 'ya_verificado':
      throw conflicto('CORREO_YA_VERIFICADO', 'Ese correo ya está verificado. Inicia sesión');
    case 'desactivada':
      throw prohibido('La cuenta está desactivada');
    case 'vencido':
      throw new ErrorApi(422, 'CODIGO_VENCIDO', 'El código venció. Pide uno nuevo');
    case 'bloqueado':
      throw new ErrorApi(429, 'CODIGO_BLOQUEADO', 'Demasiados intentos. Pide un código nuevo');
    default:
      throw new ErrorApi(
        422,
        'CODIGO_INCORRECTO',
        restantes > 0
          ? `El código no es correcto. Te quedan ${restantes} ${restantes === 1 ? 'intento' : 'intentos'}`
          : 'El código no es correcto. Pide uno nuevo',
      );
  }
}

/** Envía un código nuevo. Responde igual exista o no el correo (no revela qué correos están registrados). */
export async function reenviarCodigo(correo: string): Promise<void> {
  const r = await pool.query<{
    usuario_id: number;
    nombre_usuario: string;
    activo: boolean | null;
    segundos: number | null;
  }>(
    `SELECT u.usuario_id, u.nombre_usuario, u.activo,
            (SELECT extract(epoch FROM now() - max(k.creado_en))::float8
               FROM codigo_verificacion k WHERE k.usuario_id = u.usuario_id) AS segundos
       FROM usuario u
      WHERE lower(u.correo_electronico) = $1 AND u.correo_verificado_en IS NULL AND u.contrasena_hash IS NOT NULL`,
    [correo],
  );
  const u = r.rows[0];
  if (!u || !u.activo) return;

  if (u.segundos !== null && u.segundos < ESPERA_REENVIO_S) {
    const falta = Math.ceil(ESPERA_REENVIO_S - u.segundos);
    throw new ErrorApi(429, 'ESPERA_REENVIO', `Espera ${falta} segundos antes de pedir otro código`);
  }
  const codigo = await transaccion((c) => crearCodigo(c, u.usuario_id));
  if (!(await enviarCodigo(correo, u.nombre_usuario, codigo))) {
    throw new ErrorApi(503, 'CORREO_NO_ENVIADO', 'No se pudo enviar el correo. Inténtalo de nuevo en unos minutos');
  }
}

export async function iniciarSesion(
  input: LoginInput,
): Promise<{ usuario: UsuarioPublico; sesion: Sesion }> {
  const r = await pool.query<{
    usuario_id: number;
    nombre_usuario: string;
    correo_electronico: string | null;
    contrasena_hash: string | null;
    activo: boolean | null;
    correo_verificado_en: Date | null;
  }>(
    `SELECT usuario_id, nombre_usuario, correo_electronico, contrasena_hash, activo, correo_verificado_en
       FROM usuario WHERE lower(correo_electronico) = $1`,
    [input.correo_electronico],
  );
  const u = r.rows[0];

  // Siempre se verifica un hash, exista o no el usuario: mismo tiempo y mismo mensaje.
  const valido = await argon2
    .verify(u?.contrasena_hash ?? (await obtenerHashFalso()), input.contrasena)
    .catch(() => false);
  if (!u || !u.contrasena_hash || !valido) throw noAutenticado('Correo o contraseña incorrectos');

  if (!u.activo) throw prohibido('La cuenta está desactivada');
  if (!u.correo_verificado_en) {
    throw new ErrorApi(403, 'CORREO_NO_VERIFICADO', 'Falta verificar tu correo. Revisa tu bandeja o pide un código nuevo');
  }

  const sesion = await emitirSesion(pool, u.usuario_id, { dispositivo: input.identificador_dispositivo });
  return {
    usuario: {
      usuario_id: u.usuario_id,
      nombre_usuario: u.nombre_usuario,
      correo_electronico: u.correo_electronico,
      roles: await rolesDe(pool, u.usuario_id),
    },
    sesion,
  };
}

/**
 * Renueva la sesión. El refresh token se usa UNA sola vez (rotación).
 * Si llega uno ya usado, se asume robo y se revoca toda la familia de sesiones.
 */
export async function refrescar(refreshToken: string): Promise<Sesion> {
  const resultado = await transaccion(async (c) => {
    const r = await c.query<{
      refresh_token_id: number;
      usuario_id: number;
      familia_id: string;
      revocado: boolean;
      expira_en: Date;
      identificador_dispositivo: string | null;
      activo: boolean | null;
    }>(
      `SELECT t.refresh_token_id, t.usuario_id, t.familia_id, t.revocado, t.expira_en,
              t.identificador_dispositivo, u.activo
         FROM refresh_token t JOIN usuario u ON u.usuario_id = t.usuario_id
        WHERE t.token_hash = $1 FOR UPDATE OF t`,
      [hashRefresh(refreshToken)],
    );
    const t = r.rows[0];
    if (!t) return { error: 'invalido' as const };

    if (t.revocado) {
      await c.query('UPDATE refresh_token SET revocado = true WHERE familia_id = $1', [t.familia_id]);
      return { error: 'reutilizado' as const };
    }
    if (t.expira_en.getTime() <= Date.now() || !t.activo) return { error: 'invalido' as const };

    await c.query('UPDATE refresh_token SET revocado = true WHERE refresh_token_id = $1', [
      t.refresh_token_id,
    ]);
    const sesion = await emitirSesion(c, t.usuario_id, {
      familiaId: t.familia_id,
      dispositivo: t.identificador_dispositivo ?? undefined,
    });
    return { sesion };
  });

  if (resultado.sesion) return resultado.sesion;
  const reutilizado = resultado.error === 'reutilizado';
  throw new ErrorApi(
    401,
    reutilizado ? 'REFRESH_REUTILIZADO' : 'REFRESH_INVALIDO',
    reutilizado ? 'Sesión revocada por seguridad. Vuelve a iniciar sesión' : 'Sesión inválida o vencida',
  );
}

/** Cierra la sesión (revoca toda su familia de tokens). Es idempotente. */
export async function cerrarSesion(refreshToken: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_token SET revocado = true
      WHERE familia_id IN (SELECT familia_id FROM refresh_token WHERE token_hash = $1)`,
    [hashRefresh(refreshToken)],
  );
}

export async function cerrarTodasLasSesiones(usuarioId: number): Promise<void> {
  await pool.query('UPDATE refresh_token SET revocado = true WHERE usuario_id = $1 AND NOT revocado', [
    usuarioId,
  ]);
}

export async function perfil(usuarioId: number): Promise<UsuarioPublico> {
  const r = await pool.query<{
    usuario_id: number;
    nombre_usuario: string;
    correo_electronico: string | null;
    activo: boolean | null;
  }>('SELECT usuario_id, nombre_usuario, correo_electronico, activo FROM usuario WHERE usuario_id = $1', [
    usuarioId,
  ]);
  const u = r.rows[0];
  if (!u) throw noEncontrado('Usuario no encontrado');
  if (!u.activo) throw prohibido('La cuenta está desactivada');
  return {
    usuario_id: u.usuario_id,
    nombre_usuario: u.nombre_usuario,
    correo_electronico: u.correo_electronico,
    roles: await rolesDe(pool, usuarioId),
  };
}
