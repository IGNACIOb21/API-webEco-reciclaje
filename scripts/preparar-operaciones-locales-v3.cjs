const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
// Destino fijo local; esta herramienta no utiliza DATABASE_URL.
const client = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres', connectionTimeoutMillis: 5000 });
(async () => {
  try {
    await client.connect();
    const result = await client.query("SELECT to_regprocedure('public.prueba_crear_punto_materiales(text,text,text,numeric,numeric,bigint[])') IS NOT NULL AS anterior, to_regclass('public.entidad_administradora') IS NOT NULL AS entidad");
    if (!result.rows[0].anterior) throw Error('Faltan las operaciones previas de prueba.');
    if (result.rows[0].entidad) throw Error('La entidad de prueba ya existe; no se cambió la base.');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'pruebas', 'operaciones-locales-v3.sql'), 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Entidad y operaciones de prueba actualizadas solo en la base local.');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* sin transacción activa */ }
    console.error('No se actualizó la base local:', error.message);
    process.exitCode = 1;
  } finally { await client.end(); }
})();
