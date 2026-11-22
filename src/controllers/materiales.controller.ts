import { Request, Response } from 'express';
import { listarMateriales } from '../services/materiales.service';

export async function obtenerMateriales(_req: Request, res: Response): Promise<void> {
  try {
    const materiales = await listarMateriales();
    res.status(200).json({ datos: materiales });
  } catch {
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudieron consultar los materiales', detalles: null } });
  }
}
