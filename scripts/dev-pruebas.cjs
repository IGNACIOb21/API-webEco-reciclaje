const fs = require('node:fs');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

if (!fs.existsSync('.env.pruebas')) {
  console.error('Falta .env.pruebas. No se iniciará la API de pruebas.');
  process.exit(1);
}
const config = dotenv.parse(fs.readFileSync('.env.pruebas'));
let url;
try { url = new URL(config.SUPABASE_URL); } catch { /* se informa abajo */ }
if (!url || url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '54321' || url.pathname !== '/' || url.username || url.password || url.search || url.hash) {
  console.error('La URL de pruebas debe apuntar a Supabase local en el puerto 54321.');
  process.exit(1);
}
if (!config.SUPABASE_PUBLISHABLE_KEY || config.SUPABASE_PUBLISHABLE_KEY.includes('PEGA_AQUI')) {
  console.error('Falta la clave publicable o anon de Supabase local.');
  process.exit(1);
}
const port = config.PORT || '3001';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 || Number(port) === 3000) {
  console.error('Usa un puerto de pruebas válido distinto del 3000.');
  process.exit(1);
}
const env = { ...process.env, SUPABASE_URL: url.origin, SUPABASE_PUBLISHABLE_KEY: config.SUPABASE_PUBLISHABLE_KEY, PORT: port, REBIN_HOST: '127.0.0.1', REBIN_ESCRITURAS_LOCALES: 'true', REBIN_ESCRITURAS_COMPARTIDAS: 'false' };
const child = spawn(process.execPath, [require.resolve('tsx/cli'), 'watch', 'src/server.ts'], { env, stdio: 'inherit' });
child.once('error', () => { console.error('No se pudo iniciar la API de pruebas.'); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
