const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');

// El proceso de pruebas reemplaza fetch antes de cargar la API: no llama a Supabase.
const codigoServidor = `
global.fetch = async (url, options = {}) => {
  const destino = String(url);
  const token = (new Headers(options.headers).get('authorization') || '').replace(/^Bearer /i, '');
  let status = 200;
  let data;
  if (destino.includes('/auth/v1/user')) {
    if (token === 'invalido') { status = 401; data = { message: 'invalid token' }; }
    else { data = { id: '00000000-0000-0000-0000-000000000001', is_anonymous: token === 'anonimo' }; }
  } else if (destino.includes('/usuario?')) {
    data = { activo: token !== 'inactivo', usuario_rol: [{ rol: { nombre: ['admin', 'inactivo'].includes(token) ? 'administrador' : 'ciudadano' } }] };
  } else if (destino.includes('/punto_reciclaje?')) {
    data = [{ punto_reciclaje_id: 1, nombre_punto: 'Punto de prueba' }];
  } else if (destino.includes('/categoria_residuo?')) {
    data = [{ categoria_residuo_id: 1, codigo: 'vidrio', nombre_categoria: 'Vidrio' }];
  } else if (destino.includes('/entidad_administradora?')) {
    data = [{ entidad_administradora_id: 1, nombre_entidad: 'Entidad de prueba', tipo_entidad: 'organizacion' }];
  } else { status = 500; data = { message: 'URL inesperada en prueba' }; }
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
};
require('./dist/server.js');
`;

let proceso;
let puerto;

function puertoLibre() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const p = socket.address().port;
      socket.close(error => error ? reject(error) : resolve(p));
    });
  });
}

function peticion(path, token, method = 'GET') {
  return new Promise((resolve, reject) => {
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    const req = http.request({ hostname: '127.0.0.1', port: puerto, path, headers, method }, res => {
      let body = '';
      res.on('data', parte => { body += parte; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  puerto = await puertoLibre();
  proceso = spawn(process.execPath, ['-e', codigoServidor], {
    env: { ...process.env, PORT: String(puerto), SUPABASE_URL: 'https://prueba.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_prueba', REBIN_ESCRITURAS_LOCALES: 'true', REBIN_ESCRITURAS_COMPARTIDAS: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('La API de prueba no inició')), 10000);
    proceso.stdout.on('data', data => { if (String(data).includes('escuchando')) { clearTimeout(timeout); resolve(); } });
    proceso.once('error', error => { clearTimeout(timeout); reject(error); });
    proceso.once('exit', code => { clearTimeout(timeout); reject(new Error(`La API terminó con código ${code}`)); });
  });
});

after(() => { if (proceso) proceso.kill(); });

test('la API consulta puntos sin escribir', async () => {
  const result = await peticion('/api/v1/puntos?limite=2');
  assert.equal(result.status, 200);
  assert.equal(result.body.datos[0].nombre_punto, 'Punto de prueba');
  assert.equal((await peticion('/api/v1/puntos?limite=0')).status, 400);
});

test('la API consulta materiales', async () => {
  const result = await peticion('/api/v1/materiales');
  assert.equal(result.status, 200);
  assert.equal(result.body.datos[0].codigo, 'vidrio');
});

test('la API consulta las entidades administradoras', async () => {
  const result = await peticion('/api/v1/entidades');
  assert.equal(result.status, 200);
  assert.equal(result.body.datos[0].nombre_entidad, 'Entidad de prueba');
});

test('la autorización rechaza usuarios que no son administradores activos', async () => {
  for (const [token, status] of [[undefined, 401], ['invalido', 401], ['anonimo', 403], ['ciudadano', 403], ['inactivo', 403], ['admin', 200]]) {
    assert.equal((await peticion('/api/v1/admin/me', token)).status, status);
  }
});

test('las escrituras están bloqueadas para un proyecto distinto', async () => {
  assert.equal((await peticion('/api/v1/puntos', 'admin', 'POST')).status, 503);
  assert.equal((await peticion('/api/v1/puntos/1/desactivar', 'admin', 'POST')).status, 503);
  assert.equal((await peticion('/api/v1/puntos/1/reactivar', 'admin', 'POST')).status, 503);
});

test('el panel y la sesión de prueba no están disponibles fuera del entorno local', async () => {
  const estadoPanel = await new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: puerto, path: '/panel' }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
  });
  assert.equal(estadoPanel, 404);
  assert.equal((await peticion('/api/v1/auth/sesion-local', undefined, 'POST')).status, 403);
});
