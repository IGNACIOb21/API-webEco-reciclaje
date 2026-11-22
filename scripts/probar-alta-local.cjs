const fs = require('node:fs');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const dotenv = require('dotenv');

const config = dotenv.parse(fs.readFileSync('.env.pruebas'));
const cuenta = dotenv.parse(fs.readFileSync('.env.admin-local'));
if (config.SUPABASE_URL !== 'http://127.0.0.1:54321' || !config.SUPABASE_PUBLISHABLE_KEY || !cuenta.REBIN_ADMIN_LOCAL_EMAIL || !cuenta.REBIN_ADMIN_LOCAL_PASSWORD) {
  throw Error('Falta la configuración local de pruebas.');
}
async function puertoLibre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer(); s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
async function post(base, path, body, token) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  return { status: response.status, data: await response.json() };
}

(async () => {
  let server;
  try {
    const puerto = await puertoLibre();
    server = spawn(process.execPath, ['dist/server.js'], {
      env: { ...process.env, PORT: String(puerto), REBIN_HOST: '127.0.0.1', SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_PUBLISHABLE_KEY: config.SUPABASE_PUBLISHABLE_KEY, REBIN_ESCRITURAS_LOCALES: 'true', REBIN_ESCRITURAS_COMPARTIDAS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('La API de pruebas no inició.')), 10000);
      server.stdout.on('data', d => { if (String(d).includes('escuchando')) { clearTimeout(timer); resolve(); } });
      server.once('exit', code => { clearTimeout(timer); reject(Error(`La API terminó: ${code}`)); });
    });
    const base = `http://127.0.0.1:${puerto}`;
    const sesion = await post(base, '/api/v1/auth/login', { email: cuenta.REBIN_ADMIN_LOCAL_EMAIL, password: cuenta.REBIN_ADMIN_LOCAL_PASSWORD });
    if (sesion.status !== 200 || !sesion.data.datos?.access_token) throw Error('La cuenta local no pudo iniciar sesión.');
    const nombre = `Punto de prueba nuevo ${randomUUID().slice(0, 8)}`;
    const result = await post(base, '/api/v1/puntos', {
      nombre_punto: nombre, direccion_completa: 'Dirección ficticia 300', comuna: 'Santiago',
      coordenada_latitud: -33.44, coordenada_longitud: -70.65, entidad_administradora_id: 1, materiales: [1, 2],
    }, sesion.data.datos.access_token);
    const id = result.data.datos?.punto_reciclaje_id;
    if (result.status !== 201 || !id) throw Error('La API no pudo crear el punto ficticio.');
    const comprobacion = await fetch(`${base}/api/v1/puntos/${id}/materiales`, { signal: AbortSignal.timeout(8000) });
    const materiales = await comprobacion.json();
    if (comprobacion.status !== 200 || materiales.datos?.length !== 2) throw Error('Se creó el punto, pero no se pudo verificar sus materiales.');
    console.log(`Punto ficticio creado y verificado: ${nombre}.`);
  } catch (error) {
    console.error('La prueba local no se completó:', error.message);
    process.exitCode = 1;
  } finally { if (server) server.kill(); }
})();
