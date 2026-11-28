import type { NextFunction, Request, Response } from 'express';
import { noAutenticado, prohibido } from '../lib/errors.js';
import { verificarAcceso, type ClaimsAcceso } from '../lib/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: ClaimsAcceso;
    }
  }
}

/** Exige un token de acceso válido en `Authorization: Bearer ...`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const cabecera = req.headers.authorization ?? '';
  const [tipo, token] = cabecera.split(' ');
  const claims = tipo === 'Bearer' && token ? verificarAcceso(token) : null;
  if (!claims) return next(noAutenticado('Falta iniciar sesión o la sesión venció'));
  req.auth = claims;
  next();
}

/** Exige además que el usuario tenga alguno de estos roles (usar después de requireAuth). */
export const requireRol =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.roles.some((r) => roles.includes(r))) return next(prohibido('No tienes permiso para esto'));
    next();
  };
