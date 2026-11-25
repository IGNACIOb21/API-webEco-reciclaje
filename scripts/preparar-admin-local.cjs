const fs = require('node:fs');
const { randomBytes, randomUUID } = require('node:crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const archivo = '.env.admin-local';
if (fs.existsSync(archivo)) {
  console.log('Ya existe una cuenta de prueba local; no se modificó.');
  process.exit(0);
}
const config = dotenv.parse(fs.readFileSync('.env.pruebas'));
if (config.SUPABASE_URL !== 'http://127.0.0.1:54321' || !config.SUPABASE_PUBLISHABLE_KEY) {
  throw Error('Esta operación solo admite Supabase local.');
}
const supabase = createClient('http://127.0.0.1:54321', config.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres', connectionTimeoutMillis: 5000 });

(async () => {
  let id;
  let conectado = false;
  let archivoCreado = false;
  let confirmado = false;
  let commitIniciado = false;
  try {
    await db.connect(); conectado = true;
    const estructura = await db.query("SELECT to_regprocedure('public.prueba_crear_punto_con_entidad(text,text,text,numeric,numeric,integer,bigint[])') IS NOT NULL AS preparada");
    if (!estructura.rows[0].preparada) throw Error('La base local de pruebas todavía no está preparada.');
    const email = `rebin-admin-local-${randomUUID()}@example.com`;
    const password = `Aa1!${randomBytes(24).toString('base64url')}`;
    const registro = await supabase.auth.signUp({ email, password });
    id = registro.data.user?.id;
    if (registro.error || !id || !registro.data.session) throw Error('No se pudo crear la cuenta local.');
    await db.query('BEGIN');
    const usuario = await db.query('INSERT INTO public.usuario(auth_id,nombre_usuario,activo) VALUES ($1,$2,true) RETURNING usuario_id', [id, 'Administrador local de prueba']);
    const rol = await db.query("INSERT INTO public.usuario_rol(usuario_id,rol_id) SELECT $1,rol_id FROM public.rol WHERE nombre='administrador' RETURNING rol_id", [usuario.rows[0].usuario_id]);
    if (rol.rowCount !== 1) throw Error('No se encontró el rol administrador local.');
    fs.writeFileSync(archivo, `REBIN_ADMIN_LOCAL_EMAIL=${email}\nREBIN_ADMIN_LOCAL_PASSWORD=${password}\n`, { flag: 'wx', mode: 0o600 });
    archivoCreado = true;
    commitIniciado = true;
    await db.query('COMMIT'); confirmado = true;
    console.log('Cuenta administradora ficticia creada solo en Supabase local.');
  } catch (error) {
    if (conectado && !confirmado && !commitIniciado) {
      try { await db.query('ROLLBACK'); } catch {}
      if (id) { try { await db.query('DELETE FROM auth.users WHERE id=$1', [id]); } catch {} }
    }
    if (archivoCreado && !confirmado && !commitIniciado) { try { fs.unlinkSync(archivo); } catch {} }
    console.error(commitIniciado && !confirmado ? 'El resultado de la creación local es incierto; revisa la cuenta antes de repetir.' : 'No se pudo preparar la cuenta local de prueba.');
    process.exitCode = 1;
  } finally { if (conectado) await db.end(); }
})();
