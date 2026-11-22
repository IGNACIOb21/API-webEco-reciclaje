import { NextFunction, Request, Response } from 'express';
import { clienteParaToken } from '../config/supabase';
import { tieneRolAdministrador } from '../repositories/administrador.repository';

export async function verificarAdministrador(req: Request, res: Response, next: NextFunction): Promise<void> {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
  if (!match) {
    res.status(401).json({ error: { codigo: 'NO_AUTENTICADO', mensaje: 'Se requiere una sesión válida', detalles: null } });
    return;
  }
  const cliente = clienteParaToken(match[1]);
  if (!cliente) {
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudo verificar la sesión', detalles: null } });
    return;
  }
  try {
    const { data, error } = await cliente.auth.getUser(match[1]);
    if (error) {
      const invalido = error.status === 400 || error.status === 401 || error.status === 403;
      res.status(invalido ? 401 : 503).json({ error: {
        codigo: invalido ? 'NO_AUTENTICADO' : 'SERVICIO_NO_DISPONIBLE',
        mensaje: invalido ? 'Se requiere una sesión válida' : 'No se pudo verificar la sesión', detalles: null,
      } });
      return;
    }
    if (!data.user || data.user.is_anonymous !== false) {
      res.status(403).json({ error: { codigo: 'ACCESO_DENEGADO', mensaje: 'Se requiere una cuenta de administrador', detalles: null } });
      return;
    }
    if (!await tieneRolAdministrador(cliente, data.user.id)) {
      res.status(403).json({ error: { codigo: 'ACCESO_DENEGADO', mensaje: 'Se requiere una cuenta de administrador activa', detalles: null } });
      return;
    }
    res.locals.administrador = { id: data.user.id };
    res.locals.clienteSupabase = cliente;
    next();
  } catch {
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudo verificar la autorización', detalles: null } });
  }
}
