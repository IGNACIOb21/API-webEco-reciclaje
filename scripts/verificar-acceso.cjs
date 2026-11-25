const fs = require('node:fs');
const net = require('node:net');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const config = dotenv.parse(fs.readFileSync('.env'));
if (config.SUPABASE_URL !== 'https://shkdlkbhpkbrfxemctdj.supabase.co' || !config.SUPABASE_PUBLISHABLE_KEY || config.REBIN_ESCRITURAS_COMPARTIDAS !== 'true') {
  throw Error('La API compartida no está configurada para la verificación.');
}
if (!process.stdin.isTTY) throw Error('Ejecuta esta verificación desde tu propia terminal.');

function preguntarCorreo() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Correo de tu cuenta: ', value => { rl.close(); resolve(value.trim()); });
  });
}

function preguntarContrasena() {
  return new Promise((resolve, reject) => {
    let valor = '';
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write('Contraseña (no se mostrará): ');
    function terminar(error) {
      process.stdin.off('keypress', escribir);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(valor);
    }
    function escribir(texto, tecla) {
      if (tecla?.ctrl && tecla.name === 'c') return terminar(Error('Verificación cancelada.'));
      if (tecla?.name === 'return' || tecla?.name === 'enter') return terminar();
      if (tecla?.name === 'backspace') { valor = Array.from(valor).slice(0, -1).join(''); return; }
      if (!tecla?.ctrl && !tecla?.meta && texto && !texto.includes('\u001b')) valor += texto;
    }
    process.stdin.on('keypress', escribir);
  });
}

async function puertoLibre() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); });
  });
}

(async () => {
  let server;
  try {
    const puerto = await puertoLibre();
    server = spawn(process.execPath, ['dist/server.js'], {
      env: { ...process.env, PORT: String(puerto), REBIN_HOST: '127.0.0.1', SUPABASE_URL: config.SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY: config.SUPABASE_PUBLISHABLE_KEY, REBIN_ESCRITURAS_LOCALES: 'false', REBIN_ESCRITURAS_COMPARTIDAS: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('La API no inició.')), 10000);
      server.stdout.on('data', d => { if (String(d).includes('escuchando')) { clearTimeout(timer); resolve(); } });
      server.once('exit', code => { clearTimeout(timer); reject(Error(`La API terminó: ${code}`)); });
    });
    const email = await preguntarCorreo();
    const password = await preguntarContrasena();
    const base = `http://127.0.0.1:${puerto}`;
    const login = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(15000) });
    if (!login.ok) throw Error(login.status === 401 ? 'Correo o contraseña incorrectos.' : login.status === 403 ? 'La cuenta no tiene acceso de administrador.' : 'No se pudo verificar el acceso.');
    const data = await login.json();
    if (!data.datos?.access_token || !data.datos?.refresh_token) throw Error('La sesión recibida no es válida.');
    const me = await fetch(`${base}/api/v1/admin/me`, { headers: { authorization: `Bearer ${data.datos.access_token}` }, signal: AbortSignal.timeout(15000) });
    if (!me.ok) throw Error('La API no pudo confirmar el rol administrador.');
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: sesionError } = await supabase.auth.setSession({ access_token: data.datos.access_token, refresh_token: data.datos.refresh_token });
    if (sesionError) throw Error('El acceso funcionó, pero no se pudo cerrar la sesión temporal.');
    const { error: salidaError } = await supabase.auth.signOut({ scope: 'local' });
    if (salidaError) throw Error('El acceso funcionó, pero no se pudo cerrar la sesión temporal.');
    console.log('Acceso verificado: tu cuenta puede administrar puntos.');
  } catch (error) {
    console.error('Verificación incompleta:', error.message);
    process.exitCode = 1;
  } finally { if (server) server.kill(); }
})();
