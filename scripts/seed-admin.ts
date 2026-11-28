/**
 * Crea (o actualiza) el primer administrador. La contraseña viene de variables de entorno,
 * nunca se escribe en el código ni en el repositorio.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed-admin
 *   (también se leen desde .env). Se puede ejecutar varias veces sin duplicar.
 */
import argon2 from 'argon2';
import 'dotenv/config';
import pg from 'pg';

const correo = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const clave = process.env.ADMIN_PASSWORD;
const nombre = process.env.ADMIN_NOMBRE_USUARIO?.trim() || 'admin';

if (!process.env.DATABASE_URL || !correo || !clave) {
  console.error('Faltan DATABASE_URL, ADMIN_EMAIL o ADMIN_PASSWORD (en .env o como variables).');
  process.exit(1);
}
if (clave.length < 12) {
  console.error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

try {
  const hash = await argon2.hash(clave, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const existente = await cliente.query<{ usuario_id: number }>(
      'SELECT usuario_id FROM usuario WHERE lower(correo_electronico) = $1',
      [correo],
    );
    let id = existente.rows[0]?.usuario_id;
    if (id) {
      await cliente.query('UPDATE usuario SET contrasena_hash = $1, activo = true, correo_verificado_en = COALESCE(correo_verificado_en, now()) WHERE usuario_id = $2', [hash, id]);
    } else {
      const r = await cliente.query<{ usuario_id: number }>(
        'INSERT INTO usuario (nombre_usuario, correo_electronico, contrasena_hash, correo_verificado_en) VALUES ($1, $2, $3, now()) RETURNING usuario_id',
        [nombre, correo, hash],
      );
      id = r.rows[0]!.usuario_id;
    }
    // Rol administrador (y ciudadano, que tiene todo usuario)
    await cliente.query(
      `INSERT INTO usuario_rol (usuario_id, rol_id)
       SELECT $1, rol_id FROM rol WHERE nombre IN ('administrador', 'ciudadano')
       ON CONFLICT DO NOTHING`,
      [id],
    );
    await cliente.query('COMMIT');
    console.log(`Administrador listo: ${correo} (usuario_id ${id})`);
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
} catch (e) {
  console.error('No se pudo crear el administrador:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
