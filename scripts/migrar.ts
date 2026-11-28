/**
 * Aplica las migraciones de db/migrations en orden. Todas son seguras de repetir.
 *   npm run db:migrate
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

const carpeta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

export async function aplicarMigraciones(pool: pg.Pool, opciones: { dev?: boolean } = {}) {
  const archivos = fs
    .readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // 0001 y 0002 solo sirven para crear una base NUEVA. Si ya existe la tabla usuario
  // (por ejemplo tu Supabase real), se saltan para no tocar nada de lo que ya tienes.
  const existe = await pool.query<{ e: boolean }>("SELECT to_regclass('public.usuario') IS NOT NULL AS e");
  const baseYaExiste = existe.rows[0]!.e;

  for (const archivo of archivos) {
    if (baseYaExiste && /^000[12]_/.test(archivo)) {
      if (!opciones.dev) console.log(`Saltada (la base ya existe): ${archivo}`);
      continue;
    }
    await pool.query(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
    if (!opciones.dev) console.log(`Migración aplicada: ${archivo}`);
  }
}

// Si se ejecuta directo (npm run db:migrate), usa DATABASE_URL del .env
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en el archivo .env');
    process.exit(1);
  }
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  aplicarMigraciones(pool)
    .then(() => console.log('Listo.'))
    .catch((e) => {
      console.error('Falló la migración:', (e as Error).message);
      process.exitCode = 1;
    })
    .finally(() => void pool.end());
}
