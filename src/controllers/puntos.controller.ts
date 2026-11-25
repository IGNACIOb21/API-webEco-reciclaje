import { Request, Response } from 'express';
import { z } from 'zod';
import { buscarMaterialesDelPunto, buscarPunto, listarPuntos } from '../services/puntos.service';

const entero = (maximo: number, defecto: number) => z.preprocess(
  valor => valor === undefined ? defecto : typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor,
  z.number().int().min(1).max(maximo),
);
const consulta = z.object({ pagina: entero(10000, 1), limite: entero(100, 25) });

export async function obtenerPuntos(req: Request, res: Response): Promise<void> {
  const validacion = consulta.safeParse(req.query);
  if (!validacion.success) {
    res.status(400).json({ error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'La página o el límite no son válidos', detalles: validacion.error.flatten() } });
    return;
  }
  const { pagina, limite } = validacion.data;
  try {
    const puntos = await listarPuntos(pagina, limite);
    res.status(200).json({ datos: puntos, paginacion: { pagina, limite } });
  } catch {
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudieron consultar los puntos', detalles: null } });
  }
}

export async function obtenerPunto(req: Request, res: Response): Promise<void> {
  const id = entero(Number.MAX_SAFE_INTEGER, 1).safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'El número de punto no es válido', detalles: null } });
    return;
  }
  try {
    const punto = await buscarPunto(id.data);
    if (!punto) {
      res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Punto no encontrado', detalles: null } });
      return;
    }
    res.status(200).json({ datos: punto });
  } catch {
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudo consultar el punto', detalles: null } });
  }
}

export async function obtenerMaterialesDelPunto(req: Request, res: Response): Promise<void> {
  const id = entero(Number.MAX_SAFE_INTEGER, 1).safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'El número de punto no es válido', detalles: null } });
    return;
  }
  try {
    const materiales = await buscarMaterialesDelPunto(id.data);
    if (materiales === null) {
      res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Punto no encontrado', detalles: null } });
      return;
    }
    res.status(200).json({ datos: materiales });
  } catch {
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudieron consultar los materiales del punto', detalles: null } });
  }
}
