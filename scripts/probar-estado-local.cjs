const fs = require('node:fs');
const net = require('node:net');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

const id = process.argv[2];
const accion = process.argv[3];
if (!/^[1-9]\d*$/.test(id || '') || Number(id) > 2147483647 || !['desactivar', 'reactivar'].includes(accion)) {
  console.error('Indica un número de punto y la acción desactivar o reactivar.');
  process.exit(1);
}
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
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  return { status: response.status, body: await response.json() };
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
    const anterior = await json(`${base}/api/v1/puntos/${id}`);
    if (anterior.status !== 200 || !anterior.body.datos?.nombre_punto?.startsWith('Punto de prueba nuevo ')) throw Error('El punto no corresponde al ejemplo creado para esta prueba.');
    const login = await json(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: cuenta.REBIN_ADMIN_LOCAL_EMAIL, password: cuenta.REBIN_ADMIN_LOCAL_PASSWORD }),
    });
    if (login.status !== 200 || !login.body.datos?.access_token) throw Error('La cuenta local no pudo iniciar sesión.');
    const cambio = await json(`${base}/api/v1/puntos/${id}/${accion}`, {
      method: 'POST', headers: { authorization: `Bearer ${login.body.datos.access_token}` },
    });
    const esperado = accion === 'desactivar' ? 'fuera_servicio' : 'operativo';
    if (cambio.status !== 200 || cambio.body.datos?.estado_operativo !== esperado) throw Error('La API no confirmó el cambio de estado.');
    const verificacion = await json(`${base}/api/v1/puntos/${id}`);
    if (verificacion.status !== 200 || verificacion.body.datos?.estado_operativo !== esperado) throw Error('No se pudo comprobar el estado guardado.');
    console.log(`Punto ficticio ${id}: estado ${esperado}.`);
  } catch (error) {
    console.error('La prueba local no se completó:', error.message);
    process.exitCode = 1;
  } finally { if (server) server.kill(); }
})();
