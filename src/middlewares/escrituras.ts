import { NextFunction, Request, Response } from 'express';
import { modoEscritura } from '../config/modo-escritura';

export function permitirEscrituras(_req: Request, res: Response, next: NextFunction): void {
  const modo = modoEscritura();
  if (modo) {
    res.locals.modoEscritura = modo;
    next();
    return;
  }
  res.status(503).json({ error: { codigo: 'OPERACION_NO_HABILITADA', mensaje: 'La operación no está habilitada en este entorno', detalles: null } });
}
