import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DB_SSL ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

/** Lo que tienen en común el pool y un cliente de transacción: sirve para pasar cualquiera de los dos. */
export type Consulta = Pick<pg.Pool, 'query'>;

/** Ejecuta `fn` dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza un error. */
export async function transaccion<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    cliente.release();
  }
}
