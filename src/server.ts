import 'dotenv/config';
import express, { ErrorRequestHandler, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { saludRouter } from './routes/salud.routes';
import { administradorRouter } from './routes/administrador.routes';
import { puntosRouter } from './routes/puntos.routes';
import { materialesRouter } from './routes/materiales.routes';
import { entidadesRouter } from './routes/entidades.routes';
import { autenticacionRouter } from './routes/autenticacion.routes';
import { modoEscritura } from './config/modo-escritura';
import path from 'node:path';

const config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  REBIN_HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
}).safeParse(process.env);

if (!config.success) {
  console.error('Configuración inválida:', config.error.flatten().fieldErrors);
  process.exit(1);
}

const app = express();
app.use(express.json());

app.get('/config-publica', (_req, res) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  res.set('Cache-Control', 'no-store');
  if (!url || !key?.startsWith('sb_publishable_')) {
    res.status(503).json({ error: 'Falta configurar la URL o clave publicable de Supabase.' });
    return;
  }
  res.json({ url, key });
});
app.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.sendFile(path.resolve('web/index.html'));
});
const panelDisponible = () => modoEscritura() === 'local' || (modoEscritura() === 'compartida' && config.data.REBIN_HOST === '127.0.0.1');
app.get('/panel/config', (_req, res) => {
  if (!panelDisponible()) { res.sendStatus(404); return; }
  res.set('Cache-Control', 'no-store');
  res.json({ modo: modoEscritura() });
});
app.get('/panel', (_req, res) => {
  if (!panelDisponible()) {
    res.status(404).send('El panel no está disponible con esta configuración.');
    return;
  }
  res.set('Cache-Control', 'no-store');
  res.set('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.sendFile(path.resolve('web/panel.html'));
});
app.get('/panel.js', (_req, res) => {
  if (!panelDisponible()) { res.sendStatus(404); return; }
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.resolve('web/panel.js'));
});
app.get('/panel.css', (_req, res) => {
  if (!panelDisponible()) { res.sendStatus(404); return; }
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.resolve('web/panel.css'));
});
app.use('/publico', express.static(path.resolve('dist-public')));

app.use('/api/v1', saludRouter);
app.use('/api/v1', puntosRouter);
app.use('/api/v1', materialesRouter);
app.use('/api/v1', entidadesRouter);
app.use('/api/v1', autenticacionRouter);
app.use('/api/v1', administradorRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada', detalles: null } });
});

const manejadorErrores: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'Los datos enviados no son válidos', detalles: error.flatten() },
    });
  }

  if (error instanceof SyntaxError && 'status' in error && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo JSON no es válido', detalles: null },
    });
  }

  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    return res.status(413).json({
      error: { codigo: 'CUERPO_DEMASIADO_GRANDE', mensaje: 'El cuerpo de la petición es demasiado grande', detalles: null },
    });
  }

  console.error('Error no controlado:', error);
  return res.status(500).json({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error interno', detalles: null },
  });
};
app.use(manejadorErrores);

app.listen(config.data.PORT, config.data.REBIN_HOST, () => {
  console.log(`Rebin API escuchando en el puerto ${config.data.PORT}`);
});
