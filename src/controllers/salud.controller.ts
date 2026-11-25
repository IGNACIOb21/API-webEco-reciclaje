import { Request, Response } from 'express';
import { estadoDeDatos } from '../services/salud.service';

export async function salud(_req: Request, res: Response): Promise<void> {
  const disponible = await estadoDeDatos();
  res.status(disponible ? 200 : 503).json({
    estado: disponible ? 'ok' : 'error',
    base_datos: disponible ? 'conectada' : 'desconectada',
  });
}
