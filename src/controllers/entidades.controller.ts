import { Request, Response } from 'express';
import { listarEntidades } from '../services/entidades.service';

export async function obtenerEntidades(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json({ datos: await listarEntidades() });
  } catch {
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudieron consultar las entidades', detalles: null } });
  }
}
