import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { aplicarMigraciones } from '../scripts/migrar.js';

// Se importan después de que entorno.ts fijó las variables.
const { crearApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { bandejaDePrueba } = await import('../src/lib/correo.js');

const app = crearApp();
const api = () => request(app);

const usuario = {
  nombre_usuario: 'ana_recicla',
  correo_electronico: 'Ana@Correo.cl',
  contrasena: 'clave-segura-123',
};

const ultimoCodigo = () => bandejaDePrueba[bandejaDePrueba.length - 1]!.codigo;

/** Registra a Ana: la cuenta queda SIN verificar y el código llega a la bandeja de pruebas. */
async function registrarSinVerificar() {
  const r = await api().post('/api/v1/auth/registro').send(usuario);
  expect(r.status).toBe(201);
  return r.body as { correo_electronico: string; codigo_enviado: boolean };
}

const verificar = (codigo: string, correo = 'ana@correo.cl') =>
  api().post('/api/v1/auth/verificar-correo').send({ correo_electronico: correo, codigo });

/** Registra y verifica a Ana: devuelve la sesión que entrega la verificación. */
async function registrarAna() {
  await registrarSinVerificar();
  const r = await verificar(ultimoCodigo());
  expect(r.status).toBe(200);
  return r.body as {
    usuario: { usuario_id: number; roles: string[] };
    sesion: { access_token: string; refresh_token: string };
  };
}

beforeAll(async () => {
  // Base descartable: se recrea desde cero con las migraciones reales.
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA public;');
  await aplicarMigraciones(pool, { dev: true });
});

beforeEach(async () => {
  await pool.query('TRUNCATE codigo_verificacion, refresh_token, usuario_rol, usuario RESTART IDENTITY CASCADE');
  bandejaDePrueba.length = 0;
});

afterAll(async () => {
  await pool.end();
});

describe('salud', () => {
  it('responde ok y llega a la base', async () => {
    const r = await api().get('/salud');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ estado: 'ok', base_de_datos: 'ok' });
  });
});

describe('registro', () => {
  it('crea la cuenta sin verificar, no entrega sesión y no expone ni el hash ni el código', async () => {
    const cuerpo = await registrarSinVerificar();
    expect(cuerpo.codigo_enviado).toBe(true);
    expect(JSON.stringify(cuerpo)).not.toContain(ultimoCodigo());
    expect(cuerpo).not.toHaveProperty('sesion');
    expect(ultimoCodigo()).toMatch(/^\d{6}$/);
    expect(bandejaDePrueba[0]!.para).toBe('ana@correo.cl');

    const fila = await pool.query('SELECT correo_electronico, contrasena_hash, correo_verificado_en FROM usuario');
    expect(fila.rows[0].correo_electronico).toBe('ana@correo.cl'); // guardado en minúsculas
    expect(fila.rows[0].contrasena_hash).toMatch(/^\$argon2id\$/);
    expect(fila.rows[0].contrasena_hash).not.toContain(usuario.contrasena);
    expect(fila.rows[0].correo_verificado_en).toBeNull();

    const guardado = await pool.query('SELECT codigo_hash FROM codigo_verificacion');
    expect(guardado.rows[0].codigo_hash).not.toContain(ultimoCodigo());
    const roles = await pool.query('SELECT r.nombre FROM usuario_rol ur JOIN rol r USING (rol_id)');
    expect(roles.rows.map((x) => x.nombre)).toEqual(['ciudadano']);
  });

  it('no deja registrar el mismo correo (sin distinguir mayúsculas)', async () => {
    await registrarAna();
    const r = await api()
      .post('/api/v1/auth/registro')
      .send({ ...usuario, nombre_usuario: 'otra', correo_electronico: 'ANA@correo.cl' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('CORREO_EN_USO');
  });

  it('no deja repetir el nombre de usuario', async () => {
    await registrarAna();
    const r = await api()
      .post('/api/v1/auth/registro')
      .send({ ...usuario, correo_electronico: 'otra@correo.cl', nombre_usuario: 'ANA_recicla' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('NOMBRE_USUARIO_EN_USO');
  });

  it('rechaza datos inválidos con 422 y detalle por campo', async () => {
    const r = await api()
      .post('/api/v1/auth/registro')
      .send({ nombre_usuario: 'a', correo_electronico: 'no-es-correo', contrasena: '123' });
    expect(r.status).toBe(422);
    expect(r.body.error.codigo).toBe('DATOS_INVALIDOS');
    expect(Object.keys(r.body.error.detalles)).toEqual(
      expect.arrayContaining(['nombre_usuario', 'correo_electronico', 'contrasena']),
    );
  });
});

describe('verificación de correo', () => {
  it('con el código correcto verifica el correo y entrega la sesión', async () => {
    await registrarSinVerificar();
    const r = await verificar(ultimoCodigo());
    expect(r.status).toBe(200);
    expect(r.body.usuario.roles).toEqual(['ciudadano']);
    expect(r.body.sesion.access_token).toBeTruthy();
    const fila = await pool.query('SELECT correo_verificado_en FROM usuario');
    expect(fila.rows[0].correo_verificado_en).not.toBeNull();
  });

  it('un código sirve una sola vez y un correo ya verificado da 409', async () => {
    await registrarSinVerificar();
    const codigo = ultimoCodigo();
    expect((await verificar(codigo)).status).toBe(200);
    const otra = await verificar(codigo);
    expect(otra.status).toBe(409);
    expect(otra.body.error.codigo).toBe('CORREO_YA_VERIFICADO');
  });

  it('un código incorrecto da 422 y cuenta el intento', async () => {
    await registrarSinVerificar();
    const mal = ultimoCodigo() === '000000' ? '111111' : '000000';
    const r = await verificar(mal);
    expect(r.status).toBe(422);
    expect(r.body.error.codigo).toBe('CODIGO_INCORRECTO');
    expect(r.body.error.mensaje).toContain('4 intentos');
    const fila = await pool.query('SELECT intentos FROM codigo_verificacion');
    expect(fila.rows[0].intentos).toBe(1);
  });

  it('tras 5 intentos fallidos el código se bloquea, aunque después llegue el correcto', async () => {
    await registrarSinVerificar();
    const bueno = ultimoCodigo();
    const mal = bueno === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await verificar(mal)).status).toBe(422);
    const r = await verificar(bueno);
    expect(r.status).toBe(429);
    expect(r.body.error.codigo).toBe('CODIGO_BLOQUEADO');
  });

  it('un código vencido da 422', async () => {
    await registrarSinVerificar();
    await pool.query("UPDATE codigo_verificacion SET expira_en = now() - interval '1 minute'");
    const r = await verificar(ultimoCodigo());
    expect(r.status).toBe(422);
    expect(r.body.error.codigo).toBe('CODIGO_VENCIDO');
  });

  it('un correo desconocido recibe el mismo error que un código malo', async () => {
    const r = await verificar('123456', 'nadie@correo.cl');
    expect(r.status).toBe(422);
    expect(r.body.error.codigo).toBe('CODIGO_INCORRECTO');
  });

  it('exige 6 dígitos', async () => {
    const r = await verificar('12ab');
    expect(r.status).toBe(422);
    expect(r.body.error.codigo).toBe('DATOS_INVALIDOS');
  });

  it('reenviar: hay que esperar entre envíos y el código anterior deja de servir', async () => {
    await registrarSinVerificar();
    const primero = ultimoCodigo();

    const pronto = await api().post('/api/v1/auth/reenviar-codigo').send({ correo_electronico: 'ana@correo.cl' });
    expect(pronto.status).toBe(429);
    expect(pronto.body.error.codigo).toBe('ESPERA_REENVIO');

    await pool.query("UPDATE codigo_verificacion SET creado_en = now() - interval '2 minutes'");
    const ok = await api().post('/api/v1/auth/reenviar-codigo').send({ correo_electronico: 'ana@correo.cl' });
    expect(ok.status).toBe(204);
    expect(bandejaDePrueba).toHaveLength(2);

    const nuevo = ultimoCodigo();
    if (nuevo !== primero) expect((await verificar(primero)).status).toBe(422);
    expect((await verificar(nuevo)).status).toBe(200);
  });

  it('reenviar a un correo que no existe responde igual y no manda nada', async () => {
    const r = await api().post('/api/v1/auth/reenviar-codigo').send({ correo_electronico: 'nadie@correo.cl' });
    expect(r.status).toBe(204);
    expect(bandejaDePrueba).toHaveLength(0);
  });

  it('registrar de nuevo un correo sin verificar da 409 CORREO_SIN_VERIFICAR', async () => {
    await registrarSinVerificar();
    const r = await api().post('/api/v1/auth/registro').send({ ...usuario, nombre_usuario: 'otra' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('CORREO_SIN_VERIFICAR');
  });
});

describe('login', () => {
  it('una cuenta sin verificar no entra aunque la contraseña sea correcta', async () => {
    await registrarSinVerificar();
    const r = await api()
      .post('/api/v1/auth/login')
      .send({ correo_electronico: 'ana@correo.cl', contrasena: usuario.contrasena });
    expect(r.status).toBe(403);
    expect(r.body.error.codigo).toBe('CORREO_NO_VERIFICADO');
  });

  it('entra con credenciales correctas', async () => {
    await registrarAna();
    const r = await api()
      .post('/api/v1/auth/login')
      .send({ correo_electronico: 'ana@correo.cl', contrasena: usuario.contrasena });
    expect(r.status).toBe(200);
    expect(r.body.usuario.roles).toEqual(['ciudadano']);
    expect(r.body.sesion.access_token).toBeTruthy();
    expect(JSON.stringify(r.body)).not.toContain('argon2');
  });

  it('contraseña incorrecta y correo inexistente dan el mismo 401 (no revela si el correo existe)', async () => {
    await registrarAna();
    const mala = await api()
      .post('/api/v1/auth/login')
      .send({ correo_electronico: 'ana@correo.cl', contrasena: 'incorrecta-123' });
    const inexistente = await api()
      .post('/api/v1/auth/login')
      .send({ correo_electronico: 'nadie@correo.cl', contrasena: 'incorrecta-123' });
    expect(mala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(mala.body).toEqual(inexistente.body);
  });

  it('una cuenta desactivada no entra', async () => {
    await registrarAna();
    await pool.query('UPDATE usuario SET activo = false');
    const r = await api()
      .post('/api/v1/auth/login')
      .send({ correo_electronico: 'ana@correo.cl', contrasena: usuario.contrasena });
    expect(r.status).toBe(403);
  });

  it('un usuario sin contraseña (p. ej. invitado) no puede entrar', async () => {
    await pool.query("INSERT INTO usuario (nombre_usuario, correo_electronico) VALUES ('inv', 'inv@correo.cl')");
    const r = await api()
      .post('/api/v1/auth/login')
      .send({ correo_electronico: 'inv@correo.cl', contrasena: 'lo-que-sea-123' });
    expect(r.status).toBe(401);
  });
});

describe('/auth/me y tokens', () => {
  it('devuelve el perfil con un token válido', async () => {
    const { sesion } = await registrarAna();
    const r = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${sesion.access_token}`);
    expect(r.status).toBe(200);
    expect(r.body.usuario).toMatchObject({ nombre_usuario: 'ana_recicla', roles: ['ciudadano'] });
  });

  it('sin token o con token falso da 401', async () => {
    expect((await api().get('/api/v1/auth/me')).status).toBe(401);
    const r = await api().get('/api/v1/auth/me').set('Authorization', 'Bearer token.falso.xxx');
    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('el refresh token rota; reutilizar uno viejo revoca toda la sesión', async () => {
    const { sesion } = await registrarAna();

    const r1 = await api().post('/api/v1/auth/refresh').send({ refresh_token: sesion.refresh_token });
    expect(r1.status).toBe(200);
    const nuevo = r1.body.refresh_token as string;
    expect(nuevo).not.toBe(sesion.refresh_token);

    // El viejo ya se usó: reutilizarlo se considera robo.
    const reuso = await api().post('/api/v1/auth/refresh').send({ refresh_token: sesion.refresh_token });
    expect(reuso.status).toBe(401);
    expect(reuso.body.error.codigo).toBe('REFRESH_REUTILIZADO');

    // Y el nuevo también quedó revocado.
    const trasReuso = await api().post('/api/v1/auth/refresh').send({ refresh_token: nuevo });
    expect(trasReuso.status).toBe(401);
  });

  it('logout invalida el refresh token', async () => {
    const { sesion } = await registrarAna();
    const out = await api().post('/api/v1/auth/logout').send({ refresh_token: sesion.refresh_token });
    expect(out.status).toBe(204);
    const r = await api().post('/api/v1/auth/refresh').send({ refresh_token: sesion.refresh_token });
    expect(r.status).toBe(401);
  });

  it('un refresh token vencido da 401', async () => {
    const { sesion } = await registrarAna();
    await pool.query("UPDATE refresh_token SET expira_en = now() - interval '1 minute'");
    const r = await api().post('/api/v1/auth/refresh').send({ refresh_token: sesion.refresh_token });
    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('REFRESH_INVALIDO');
  });
});

describe('formato de errores', () => {
  it('ruta inexistente → 404 con la forma estándar', async () => {
    const r = await api().get('/api/v1/nada');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({
      error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: expect.any(String), detalles: null },
    });
  });

  it('JSON mal formado → 400, sin exponer detalles internos', async () => {
    const r = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"correo": ');
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('JSON_INVALIDO');
  });
});
