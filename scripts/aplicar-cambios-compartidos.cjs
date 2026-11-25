// Herramienta de despliegue utilizada el 21-11-2026. No volver a ejecutar sin revisión.
// Requiere confirmación explícita y credenciales únicamente en variables de proceso.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

async function main() {
  if (process.env.REBIN_APROBAR_CAMBIOS !== 'SI_REBIN_BASE_COMPARTIDA') throw Error('Falta la confirmación explícita de despliegue.');
  const url = new URL(process.env.REBIN_DESPLIEGUE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'aws-0-us-east-1.pooler.supabase.com' ||
      url.port !== '5432' || decodeURIComponent(url.username) !== 'postgres.shkdlkbhpkbrfxemctdj' ||
      url.pathname !== '/postgres' || !url.password || url.search || url.hash) throw Error('Destino de base no autorizado.');
  const correo = process.env.REBIN_ADMIN_CORREO;
  const rutaCa = process.env.REBIN_SUPABASE_CA;
  if (!correo || !rutaCa) throw Error('Faltan el correo del administrador o el certificado oficial.');
  const ca = fs.readFileSync(rutaCa, 'utf8');
  const c = new Client({ host: url.hostname, port: 5432, database: 'postgres', user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 8000 });
  let committed = false;
  let commitIniciado = false;
  try {
    await c.connect();
    await c.query('BEGIN');
    await c.query("SET LOCAL lock_timeout = '5s'");
    await c.query("SET LOCAL statement_timeout = '20s'");

    const actual = await c.query("SELECT pg_get_functiondef(p.oid) AS cuerpo FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='app_puntos_cercanos'");
    if (actual.rowCount !== 1) throw Error('No se puede verificar la función del mapa.');
    const pattern = /where p\.estado_operativo <> 'fuera_servicio'\s+or not coalesce\(solo_disponibles, false\)/g;
    if ((actual.rows[0].cuerpo.match(pattern) || []).length !== 1) throw Error('La función del mapa cambió; se requiere una nueva revisión.');
    const propuesta = fs.readFileSync(path.join(__dirname, '..', 'propuestas', 'ocultar-puntos-movil.sql'), 'utf8');
    const propuestaSql = propuesta.split(/\r?\n/).filter(line => !line.startsWith('--')).join('\n').trim();
    const esperada = actual.rows[0].cuerpo.replace(pattern, "where p.estado_operativo <> 'fuera_servicio'").trim();
    if (propuestaSql !== esperada) throw Error('La función del mapa no coincide con la propuesta revisada.');

    const gestion = fs.readFileSync(path.join(__dirname, '..', 'propuestas', 'gestion-puntos.sql'), 'utf8');
    if (!/^\s*BEGIN;\s*$/m.test(gestion) || !/^\s*COMMIT;\s*$/m.test(gestion)) throw Error('La propuesta de funciones no tiene el formato esperado.');
    const cuerpoGestion = gestion.replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, '');
    await c.query(cuerpoGestion);
    await c.query(propuestaSql);
    const asignacion = fs.readFileSync(path.join(__dirname, '..', 'propuestas', 'asignar-administrador.sql'), 'utf8');
    const resultado = await c.query(asignacion, [correo]);
    if (resultado.rows[0]?.cuentas !== 1 || resultado.rows[0]?.roles_administrador !== 1) throw Error('No existe una única cuenta activa y confirmada para la asignación.');
    await c.query("SELECT pg_notify('pgrst', 'reload schema')");
    commitIniciado = true;
    await c.query('COMMIT');
    committed = true;
    console.log('Cambios aplicados en una transacción. La API requiere activar la configuración y reiniciarse.');
  } catch (error) {
    if (!committed && !commitIniciado) { try { await c.query('ROLLBACK'); } catch {} }
    // No imprimir credenciales, datos personales ni detalles de conexión.
    if (commitIniciado && !committed) console.error('Resultado del commit desconocido; revisa la base antes de repetir.');
    else console.error('No se aplicaron los cambios:', error.code || error.message);
    process.exitCode = 1;
  } finally { await c.end(); }
}
main().catch(() => { console.error('No se pudo iniciar el despliegue.'); process.exitCode = 1; });
