const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

// Destino fijo: jamás usa DATABASE_URL ni credenciales de producción.
const client = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres', connectionTimeoutMillis: 5000 });

(async () => {
  try {
    await client.connect();
    const result = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    if (result.rowCount !== 0) throw new Error('La base local no está vacía; no se modificó ninguna tabla.');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'pruebas', 'estructura-local.sql'), 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Base local preparada con datos ficticios.');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* no hay transacción abierta */ }
    console.error('No se preparó la base local:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
