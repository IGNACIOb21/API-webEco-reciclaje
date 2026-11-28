import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ErrorApi } from '../lib/errors.js';

/** Valida (y normaliza) req.body con un esquema zod. Si falla: 422 con el detalle por campo. */
export const validarBody = (esquema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
  const r = esquema.safeParse(req.body ?? {});
  if (!r.success) {
    const detalles: Record<string, string[]> = {};
    for (const i of r.error.issues) {
      const campo = i.path.join('.') || 'cuerpo';
      (detalles[campo] ??= []).push(i.message);
    }
    return next(new ErrorApi(422, 'DATOS_INVALIDOS', 'Hay datos que corregir', detalles));
  }
  req.body = r.data;
  next();
};
