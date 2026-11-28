import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { validarBody } from '../middleware/validar.js';
import * as auth from '../services/auth.service.js';
import {
  loginSchema,
  refreshSchema,
  registroSchema,
  reenviarSchema,
  verificarSchema,
} from '../validators/auth.js';

export const authRouter = Router();

// Límite estricto (F2-08): 20 intentos por IP cada 15 minutos. Cada grupo de rutas tiene su propio contador.
const crearLimite = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.NODE_ENV === 'test',
    handler: (_req, res) => {
      res.status(429).json({
        error: { codigo: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos. Espera unos minutos', detalles: null },
      });
    },
  });
const limiteAuth = crearLimite();
const limiteCodigos = crearLimite();

authRouter.post('/registro', limiteAuth, validarBody(registroSchema), async (req, res, next) => {
  try {
    res.status(201).json(await auth.registrar(req.body));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/verificar-correo', limiteCodigos, validarBody(verificarSchema), async (req, res, next) => {
  try {
    res.json(await auth.verificarCorreo(req.body));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/reenviar-codigo', limiteCodigos, validarBody(reenviarSchema), async (req, res, next) => {
  try {
    await auth.reenviarCodigo(req.body.correo_electronico);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

authRouter.post('/login', limiteAuth, validarBody(loginSchema), async (req, res, next) => {
  try {
    res.json(await auth.iniciarSesion(req.body));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/refresh', validarBody(refreshSchema), async (req, res, next) => {
  try {
    res.json(await auth.refrescar(req.body.refresh_token));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', validarBody(refreshSchema), async (req, res, next) => {
  try {
    await auth.cerrarSesion(req.body.refresh_token);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout-todo', requireAuth, async (req, res, next) => {
  try {
    await auth.cerrarTodasLasSesiones(req.auth!.usuarioId);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ usuario: await auth.perfil(req.auth!.usuarioId) });
  } catch (e) {
    next(e);
  }
});
