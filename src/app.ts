import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { config } from './config.js';
import { pool } from './db.js';
import { ErrorApi } from './lib/errors.js';
import { authRouter } from './routes/auth.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // detrás del proxy de Render/Railway, para que el límite de intentos use la IP real

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/salud', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ estado: 'ok', base_de_datos: 'ok' });
    } catch {
      res.status(503).json({ estado: 'degradado', base_de_datos: 'sin conexion' });
    }
  });

  app.use('/api/v1/auth', authRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'Ruta no encontrada', detalles: null } });
  });

  const manejarErrores: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ErrorApi) {
      res.status(err.status).json({ error: { codigo: err.codigo, mensaje: err.message, detalles: err.detalles } });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo no es un JSON válido', detalles: null } });
      return;
    }
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: { codigo: 'CUERPO_MUY_GRANDE', mensaje: 'El cuerpo es demasiado grande', detalles: null } });
      return;
    }
    console.error(err);
    res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor', detalles: null } });
  };
  app.use(manejarErrores);

  return app;
}
