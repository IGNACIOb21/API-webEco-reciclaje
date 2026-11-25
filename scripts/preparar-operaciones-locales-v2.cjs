const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
// Conexión fija a la base local de Docker; nunca se utiliza DATABASE_URL.
const client = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres', connectionTimeoutMillis: 5000 });
(async () => {
  try {
    await client.connect();
    const result = await client.query("SELECT to_regprocedure('public.prueba_crear_punto(text,text,text,numeric,numeric)') IS NOT NULL AS anterior, to_regprocedure('public.prueba_crear_punto_materiales(text,text,text,numeric,numeric,bigint[])') IS NOT NULL AS actual");
    if (!result.rows[0].anterior) throw Error('Faltan las operaciones iniciales de prueba.');
    if (result.rows[0].actual) throw Error('Las operaciones con materiales ya existen; no se cambiaron.');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'pruebas', 'operaciones-locales-v2.sql'), 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Operaciones con materiales instaladas únicamente en la base local.');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* sin transacción activa */ }
    console.error('No se actualizaron las operaciones locales:', error.message);
    process.exitCode = 1;
  } finally { await client.end(); }
})();
