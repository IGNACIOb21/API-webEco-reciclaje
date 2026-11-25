// Ejecuta la propuesta dentro de una transacción revertida contra Supabase local.
// Nunca conecta a DATABASE_URL ni escribe en el proyecto compartido.
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const cfg = dotenv.parse(fs.readFileSync('.env.pruebas'));
if (cfg.SUPABASE_URL !== 'http://127.0.0.1:54321' || !cfg.SUPABASE_PUBLISHABLE_KEY) throw Error('Se requiere Supabase local.');
const db = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres' });
const ids = [];
const check = (condition, message) => { if (!condition) throw Error(message); };
async function crearCuenta() {
  const s = createClient('http://127.0.0.1:54321', cfg.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await s.auth.signUp({ email: `audit-${randomUUID()}@example.com`, password: `Az9!${randomUUID()}` });
  if (error || !data.user) throw Error('No se pudo crear una cuenta ficticia.');
  ids.push(data.user.id);
  return data.user.id;
}
async function crearUsuario(id, rol) {
  const { rows } = await db.query('INSERT INTO public.usuario(auth_id,nombre_usuario,activo) VALUES ($1,$2,true) RETURNING usuario_id', [id, `prueba-${rol}`]);
  await db.query('INSERT INTO public.usuario_rol(usuario_id,rol_id) SELECT $1,rol_id FROM public.rol WHERE nombre=$2', [rows[0].usuario_id, rol]);
}
async function identidad(id) {
  await db.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, role: 'authenticated', is_anonymous: false })]);
}
async function debeRechazar(funcion, parametros, codigo) {
  await db.query('SAVEPOINT caso');
  let rechazado = false;
  try { await db.query(funcion, parametros); } catch (error) { rechazado = error.code === codigo; }
  await db.query('ROLLBACK TO SAVEPOINT caso');
  check(rechazado, `No se rechazó la operación como se esperaba (${codigo}).`);
}

(async () => {
  let conectado = false;
  try {
    const admin = await crearCuenta();
    const ciudadano = await crearCuenta();
    await db.connect(); conectado = true;
    await db.query('BEGIN');
    const propuesta = fs.readFileSync('propuestas/gestion-puntos.sql', 'utf8')
      .replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, '');
    await db.query(propuesta);
    await crearUsuario(admin, 'ciudadano');
    await crearUsuario(ciudadano, 'ciudadano');
    const correo = await db.query('SELECT email FROM auth.users WHERE id=$1', [admin]);
    const asignacionSql = fs.readFileSync('propuestas/asignar-administrador.sql', 'utf8');
    const noExiste = await db.query(asignacionSql, [`ausente-${randomUUID()}@example.com`]);
    check(noExiste.rows[0].cuentas === 0 && noExiste.rows[0].asignaciones === 0, 'Se asignó un rol a una cuenta inexistente.');
    const asignacion = await db.query(asignacionSql, [correo.rows[0].email]);
    check(asignacion.rows[0].cuentas === 1 && asignacion.rows[0].roles_administrador === 1 && asignacion.rows[0].asignaciones === 1, 'No se asignó el rol de prueba.');
    const repetida = await db.query(asignacionSql, [correo.rows[0].email]);
    check(repetida.rows[0].asignaciones === 0, 'La asignación repetida no fue idempotente.');
    const rolesAdmin = await db.query('SELECT count(*)::int AS total FROM public.usuario_rol WHERE usuario_id=(SELECT usuario_id FROM public.usuario WHERE auth_id=$1)', [admin]);
    check(rolesAdmin.rows[0].total === 2, 'La asignación no conservó el rol ciudadano.');
    const permisos = await db.query("SELECT has_function_privilege('anon','public.api_crear_punto(text,text,text,numeric,numeric,integer,integer[])','EXECUTE') AS anon, has_function_privilege('authenticated','public.api_exigir_administrador()','EXECUTE') AS helper");
    check(!permisos.rows[0].anon && !permisos.rows[0].helper, 'Permisos de funciones inesperados.');
    await db.query('SET LOCAL ROLE authenticated');
    const args = ['Punto de contrato ficticio', 'Dirección de prueba', 'Santiago', -33.4, -70.6, 1, [1, 2]];
    const llamada = 'SELECT public.api_crear_punto($1,$2,$3,$4,$5,$6,$7) AS punto';
    await identidad(ciudadano);
    await debeRechazar(llamada, args, '42501');
    await identidad(admin);
    await debeRechazar(llamada, [...args.slice(0, 6), [1, 999999]], '22023');
    await debeRechazar(llamada, [...args.slice(0, 5), 999999, args[6]], '22023');
    const creado = await db.query(llamada, args);
    const id = creado.rows[0].punto.punto_reciclaje_id;
    check(creado.rows[0].punto.entidad_administradora_id === 1 && creado.rows[0].punto.materiales.length === 2, 'El punto no tiene la entidad y los materiales esperados.');
    const links = await db.query('SELECT count(*)::int AS total FROM public.punto_categoria WHERE punto_reciclaje_id=$1', [id]);
    check(links.rows[0].total === 2, 'No se vincularon los materiales.');
    const apagado = await db.query('SELECT public.api_desactivar_punto($1) AS punto', [id]);
    check(apagado.rows[0].punto.estado_operativo === 'fuera_servicio', 'No se desactivó el punto.');
    const reactivado = await db.query('SELECT public.api_reactivar_punto($1) AS punto', [id]);
    check(reactivado.rows[0].punto.estado_operativo === 'operativo', 'No se reactivó el punto.');

    // La propuesta para el mapa se comprueba en la misma transacción y se revierte.
    await db.query('SELECT public.api_desactivar_punto($1)', [id]);
    await db.query('RESET ROLE');
    const objetos = await db.query("SELECT to_regclass('public.calificacion_punto') IS NOT NULL AS calificaciones, to_regprocedure('public.app_puntos_cercanos(double precision,double precision,double precision,text,text[],boolean,double precision)') IS NOT NULL AS funcion, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='punto_reciclaje' AND column_name='osm_id') AS osm");
    check(!objetos.rows[0].calificaciones && !objetos.rows[0].funcion && !objetos.rows[0].osm, 'La prueba del mapa requiere el esquema local de ejemplo sin cambios adicionales.');
    await db.query('ALTER TABLE public.punto_reciclaje ADD COLUMN osm_id text');
    await db.query('CREATE TABLE public.calificacion_punto (punto_reciclaje_id bigint NOT NULL, puntuacion integer NOT NULL)');
    await db.query(fs.readFileSync('propuestas/ocultar-puntos-movil.sql', 'utf8'));
    const mapa = await db.query('SELECT id FROM public.app_puntos_cercanos($1,$2,$3,$4,$5,$6,$7)', [-33.4, -70.6, 100, null, null, false, 0]);
    check(!mapa.rows.some(row => row.id === String(id)) && mapa.rows.some(row => row.id === '1'), 'El mapa no filtró correctamente el punto desactivado.');
    await db.query('ROLLBACK');
    console.log('Autorización, contrato y filtro del mapa verificados localmente; los cambios se revirtieron.');
  } catch (error) {
    if (conectado) { try { await db.query('ROLLBACK'); } catch {} }
    console.error('Prueba de contrato incompleta:', error.message);
    process.exitCode = 1;
  } finally {
    if (conectado) {
      try { if (ids.length) await db.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [ids]); }
      catch { console.error('No se pudieron eliminar cuentas ficticias locales.'); process.exitCode = 1; }
      await db.end();
    }
  }
})();
