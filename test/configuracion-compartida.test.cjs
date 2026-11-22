const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');

const simular = `
global.fetch = async (url, options = {}) => {
  const destino = String(url);
  let data;
  if (destino.includes('/auth/v1/user')) data = { id: '00000000-0000-0000-0000-000000000001', is_anonymous: false };
  else if (destino.includes('/usuario?')) data = { activo: true, usuario_rol: [{ rol: { nombre: 'administrador' } }] };
  else if (destino.includes('/rpc/api_crear_punto')) data = { punto_reciclaje_id: 99, entidad_administradora_id: 1 };
  else return new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
};
require('./dist/server.js');
`;

async function ejecutar(url, habilitado) {
  const puerto = await new Promise((resolve, reject) => {
    const s = net.createServer(); s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
  const server = spawn(process.execPath, ['-e', simular], {
    env: { ...process.env, PORT: String(puerto), SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_prueba', REBIN_ESCRITURAS_LOCALES: 'false', REBIN_ESCRITURAS_COMPARTIDAS: habilitado },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((ok, bad) => {
      const t = setTimeout(() => bad(Error('No inició la API simulada')), 10000);
      server.stdout.on('data', d => { if (String(d).includes('escuchando')) { clearTimeout(t); ok(); } });
      server.once('exit', n => { clearTimeout(t); bad(Error(`La API terminó ${n}`)); });
    });
    const body = JSON.stringify({ nombre_punto: 'Punto', direccion_completa: 'Dirección', comuna: 'Santiago', coordenada_latitud: -33.4, coordenada_longitud: -70.6, entidad_administradora_id: 1, materiales: [1] });
    return await new Promise((ok, bad) => {
      const req = http.request({ hostname: '127.0.0.1', port: puerto, path: '/api/v1/puntos', method: 'POST', headers: { authorization: 'Bearer admin', 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
        let data=''; res.on('data', d => { data += d; }); res.on('end', () => ok({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', bad); req.end(body);
    });
  } finally { server.kill(); }
}

test('escrituras compartidas requieren activación y proyecto correcto', async () => {
  assert.equal((await ejecutar('https://shkdlkbhpkbrfxemctdj.supabase.co', 'false')).status, 503);
  assert.equal((await ejecutar('https://otro.supabase.co', 'true')).status, 503);
  const resultado = await ejecutar('https://shkdlkbhpkbrfxemctdj.supabase.co', 'true');
  assert.equal(resultado.status, 201);
  assert.equal(resultado.body.datos.punto_reciclaje_id, 99);
});
