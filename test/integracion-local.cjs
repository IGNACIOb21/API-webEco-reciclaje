const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const net = require('node:net');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const cfg = dotenv.parse(fs.readFileSync('.env.pruebas'));
if (cfg.SUPABASE_URL !== 'http://127.0.0.1:54321' || !cfg.SUPABASE_PUBLISHABLE_KEY) {
  throw Error('Las pruebas de escritura solo admiten la instancia local esperada.');
}
const base = 'http://127.0.0.1:54321';
const sql = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres' });
const identificadores = [];
let puntoId;
let server;

function requireCheck(cond, message) { if (!cond) throw Error(message); }
async function puertoLibre() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); });
  });
}
async function usuarioPrueba(rol) {
  const cliente = createClient(base, cfg.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `rebin-${randomUUID()}@example.com`;
  const password = `Az9!${randomUUID()}`;
  const { data, error } = await cliente.auth.signUp({ email, password });
  if (error || !data.user || !data.session) throw Error('No se pudo crear una sesión ficticia local.');
  identificadores.push(data.user.id);
  const result = await sql.query('INSERT INTO public.usuario(auth_id,nombre_usuario,activo) VALUES ($1,$2,true) RETURNING usuario_id', [data.user.id, `prueba-${rol}`]);
  await sql.query('INSERT INTO public.usuario_rol(usuario_id,rol_id) SELECT $1,rol_id FROM public.rol WHERE nombre=$2', [result.rows[0].usuario_id, rol]);
  return { cliente, token: data.session.access_token, id: data.user.id, email, password };
}
async function request(puerto, ruta, token, body) {
  const response = await fetch(`http://127.0.0.1:${puerto}${ruta}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

(async () => {
  let conectado = false;
  try {
    await sql.connect(); conectado = true;
    const admin = await usuarioPrueba('administrador');
    const ciudadano = await usuarioPrueba('ciudadano');
    const puerto = await puertoLibre();
    server = spawn(process.execPath, ['dist/server.js'], {
      env: { ...process.env, PORT: String(puerto), SUPABASE_URL: base, SUPABASE_PUBLISHABLE_KEY: cfg.SUPABASE_PUBLISHABLE_KEY, REBIN_ESCRITURAS_LOCALES: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((ok, bad) => {
      const timer = setTimeout(() => bad(Error('La API de pruebas no inició.')), 10000);
      server.stdout.on('data', d => { if (String(d).includes('escuchando')) { clearTimeout(timer); ok(); } });
      server.once('exit', n => { clearTimeout(timer); bad(Error(`La API terminó: ${n}`)); });
    });
    const pagina = await fetch(`http://127.0.0.1:${puerto}/panel`);
    requireCheck(pagina.status === 200 && (await pagina.text()).includes('aviso-entorno'), 'El panel local no está disponible.');
    const origenInvalido = await fetch(`http://127.0.0.1:${puerto}/api/v1/auth/sesion-local`, { method: 'POST', headers: { origin: 'https://externo.example', 'content-type': 'application/json' }, body: '{}' });
    requireCheck(origenInvalido.status === 403, 'Se aceptó una solicitud de sesión desde otro origen.');
    const sinOrigen = await fetch(`http://127.0.0.1:${puerto}/api/v1/auth/sesion-local`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    requireCheck(sinOrigen.status === 403, 'Se aceptó una solicitud de sesión sin origen.');
    if (fs.existsSync('.env.admin-local')) {
      const origenLocal = await fetch(`http://127.0.0.1:${puerto}/api/v1/auth/sesion-local`, { method: 'POST', headers: { origin: `http://127.0.0.1:${puerto}`, 'content-type': 'application/json' }, body: '{}' });
      const sesionLocal = await origenLocal.json();
      requireCheck(origenLocal.status === 200 && sesionLocal.datos?.access_token, 'No se pudo iniciar la sesión local del panel.');
    }
    const login = await request(puerto, '/api/v1/auth/login', null, { email: admin.email, password: admin.password });
    requireCheck(login.status === 200 && login.body.datos?.access_token && login.body.datos?.refresh_token, 'El administrador no pudo iniciar sesión.');
    requireCheck((await request(puerto, '/api/v1/auth/login', null, { email: ciudadano.email, password: ciudadano.password })).status === 403, 'Una cuenta ciudadana obtuvo una sesión de administrador.');
    requireCheck((await request(puerto, '/api/v1/auth/login', null, { email: admin.email, password: 'contraseña-incorrecta' })).status === 401, 'Una contraseña incorrecta no fue rechazada.');
    const renovada = await request(puerto, '/api/v1/auth/refrescar', null, { refresh_token: login.body.datos.refresh_token });
    requireCheck(renovada.status === 200 && renovada.body.datos?.access_token && renovada.body.datos?.refresh_token, 'La sesión no pudo renovarse.');
    await sql.query('UPDATE public.usuario SET activo=false WHERE auth_id=$1', [admin.id]);
    const cuentaInactiva = await request(puerto, '/api/v1/auth/refrescar', null, { refresh_token: renovada.body.datos.refresh_token });
    requireCheck(cuentaInactiva.status === 403, 'Una cuenta inactiva pudo renovar su sesión.');
    await sql.query('UPDATE public.usuario SET activo=true WHERE auth_id=$1', [admin.id]);
    const punto = { nombre_punto: `Punto temporal ${randomUUID()}`, direccion_completa: 'Dirección ficticia', comuna: 'Santiago', coordenada_latitud: -33.4, coordenada_longitud: -70.6, entidad_administradora_id: 1, materiales: [1, 2] };
    requireCheck((await request(puerto, '/api/v1/puntos', null, punto)).status === 401, 'Una solicitud sin sesión no fue rechazada.');
    requireCheck((await request(puerto, '/api/v1/puntos', ciudadano.token, punto)).status === 403, 'Una cuenta ciudadana no fue rechazada.');
    const intentoDirecto = await ciudadano.cliente.rpc('prueba_crear_punto_con_entidad', { p_nombre: punto.nombre_punto, p_direccion: punto.direccion_completa, p_comuna: punto.comuna, p_latitud: punto.coordenada_latitud, p_longitud: punto.coordenada_longitud, p_entidad: punto.entidad_administradora_id, p_materiales: punto.materiales });
    requireCheck(!!intentoDirecto.error, 'La base no rechazó una escritura directa de ciudadano.');
    requireCheck((await request(puerto, '/api/v1/puntos', admin.token, { ...punto, coordenada_latitud: 200 })).status === 400, 'Una coordenada inválida no fue rechazada.');
    requireCheck((await request(puerto, '/api/v1/puntos', admin.token, { ...punto, materiales: [1, 1] })).status === 400, 'Los materiales duplicados no fueron rechazados.');
    requireCheck((await request(puerto, '/api/v1/puntos', admin.token, { ...punto, materiales: [1, 999999] })).status === 400, 'Un material inexistente no fue rechazado.');
    requireCheck((await request(puerto, '/api/v1/puntos', admin.token, { ...punto, entidad_administradora_id: 999999 })).status === 400, 'Una entidad inexistente no fue rechazada.');
    const previo = await sql.query('SELECT count(*)::int AS total FROM public.punto_reciclaje WHERE nombre_punto=$1', [punto.nombre_punto]);
    requireCheck(previo.rows[0].total === 0, 'Una solicitud inválida creó un punto.');
    const creado = await request(puerto, '/api/v1/puntos', admin.token, punto);
    requireCheck(creado.status === 201 && creado.body.datos?.punto_reciclaje_id, 'No se creó el punto ficticio.');
    puntoId = creado.body.datos.punto_reciclaje_id;
    requireCheck(creado.body.datos.entidad_administradora_id === 1, 'La entidad no quedó asociada.');
    requireCheck((await request(puerto, `/api/v1/puntos/${puntoId}/desactivar`, ciudadano.token, {})).status === 403, 'Una cuenta ciudadana pudo intentar desactivar un punto.');
    const desactivarDirecto = await ciudadano.cliente.rpc('prueba_desactivar_punto', { p_id: puntoId });
    requireCheck(!!desactivarDirecto.error, 'La base no rechazó la desactivación directa de ciudadano.');
    const estadoTrasIntento = await sql.query('SELECT estado_operativo FROM public.punto_reciclaje WHERE punto_reciclaje_id=$1', [puntoId]);
    requireCheck(estadoTrasIntento.rows[0]?.estado_operativo === 'operativo', 'El intento de un ciudadano alteró el punto.');
    const materialesResponse = await fetch(`http://127.0.0.1:${puerto}/api/v1/puntos/${puntoId}/materiales`);
    const materiales = await materialesResponse.json();
    requireCheck(materialesResponse.status === 200 && materiales.datos?.length === 2, 'No se guardaron los materiales del punto.');
    const apagado = await request(puerto, `/api/v1/puntos/${puntoId}/desactivar`, admin.token, {});
    requireCheck(apagado.status === 200 && apagado.body.datos?.estado_operativo === 'fuera_servicio', 'No se desactivó el punto ficticio.');
    requireCheck((await request(puerto, `/api/v1/puntos/${puntoId}/reactivar`, ciudadano.token, {})).status === 403, 'Una cuenta ciudadana pudo intentar reactivar un punto.');
    const reactivarDirecto = await ciudadano.cliente.rpc('prueba_reactivar_punto', { p_id: puntoId });
    requireCheck(!!reactivarDirecto.error, 'La base no rechazó la reactivación directa de ciudadano.');
    const estadoDesactivado = await sql.query('SELECT estado_operativo FROM public.punto_reciclaje WHERE punto_reciclaje_id=$1', [puntoId]);
    requireCheck(estadoDesactivado.rows[0]?.estado_operativo === 'fuera_servicio', 'El intento de un ciudadano reactivó el punto.');
    const reactivado = await request(puerto, `/api/v1/puntos/${puntoId}/reactivar`, admin.token, {});
    requireCheck(reactivado.status === 200 && reactivado.body.datos?.estado_operativo === 'operativo', 'No se reactivó el punto ficticio.');
    requireCheck((await request(puerto, '/api/v1/puntos/99999999/desactivar', admin.token, {})).status === 404, 'No se detectó el punto inexistente.');
    console.log('Pruebas locales aprobadas: inicio y renovación de sesión, permisos, validación, creación con materiales, desactivación y reactivación.');
  } catch (error) {
    console.error('Pruebas locales incompletas:', error.message);
    process.exitCode = 1;
  } finally {
    if (server) server.kill();
    if (conectado) {
      try {
        if (puntoId) {
          await sql.query('DELETE FROM public.punto_categoria WHERE punto_reciclaje_id=$1', [puntoId]);
          await sql.query('DELETE FROM public.punto_reciclaje WHERE punto_reciclaje_id=$1', [puntoId]);
        }
        if (identificadores.length) {
          await sql.query('DELETE FROM public.usuario_rol WHERE usuario_id IN (SELECT usuario_id FROM public.usuario WHERE auth_id = ANY($1::uuid[]))', [identificadores]);
          await sql.query('DELETE FROM public.usuario WHERE auth_id = ANY($1::uuid[])', [identificadores]);
          await sql.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [identificadores]);
        }
      } catch (error) { console.error('No se pudieron limpiar todos los datos ficticios:', error.message); process.exitCode = 1; }
      await sql.end();
    }
  }
})();
