const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
// Destino fijo: esta herramienta nunca usa DATABASE_URL ni accede a producción.
const client = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres', connectionTimeoutMillis: 5000 });
(async () => {
  try {
    await client.connect();
    const estado = await client.query("SELECT to_regclass('public.punto_reciclaje') IS NOT NULL AS existe, to_regprocedure('public.prueba_crear_punto(text,text,text,numeric,numeric)') IS NOT NULL AS instalada");
    if (!estado.rows[0].existe) throw Error('Falta preparar la base local de pruebas.');
    if (estado.rows[0].instalada) throw Error('Las operaciones de prueba ya existen; no se cambiaron.');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'pruebas', 'operaciones-locales.sql'), 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Operaciones instaladas únicamente en la base local de pruebas.');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* no hay transacción */ }
    console.error('No se prepararon las operaciones locales:', error.message);
    process.exitCode = 1;
  } finally { await client.end(); }
})();
