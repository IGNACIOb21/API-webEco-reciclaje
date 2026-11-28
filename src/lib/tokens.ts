import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface ClaimsAcceso {
  usuarioId: number;
  roles: string[];
}

/** Token de acceso (JWT corto). Lleva el id y los roles. */
export function firmarAcceso(usuarioId: number, roles: string[]): string {
  return jwt.sign({ roles }, config.JWT_SECRET, {
    subject: String(usuarioId),
    expiresIn: config.ACCESS_TOKEN_TTL_MIN * 60,
    algorithm: 'HS256',
  });
}

/** Devuelve los datos del token o null si es inválido o venció. */
export function verificarAcceso(token: string): ClaimsAcceso | null {
  try {
    const p = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof p === 'string' || !p.sub) return null;
    const usuarioId = Number(p.sub);
    if (!Number.isInteger(usuarioId)) return null;
    return { usuarioId, roles: Array.isArray(p.roles) ? (p.roles as string[]) : [] };
  } catch {
    return null;
  }
}

export const hashRefresh = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** Refresh token aleatorio. En la base solo se guarda su hash. */
export function generarRefresh(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  return { token, hash: hashRefresh(token) };
}
