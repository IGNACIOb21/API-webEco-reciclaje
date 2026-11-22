import { Request, Response } from 'express';
import { z } from 'zod';
import { nuevoPuntoSchema } from '../validators/puntos.validator';
import { crearPunto as crearEnServicio, desactivarPunto as desactivarEnServicio, reactivarPunto as reactivarEnServicio } from '../services/puntos-escritura.service';
import { DatosPuntoInvalidos, EscrituraDenegada } from '../repositories/puntos-escritura.repository';

export async function crearPunto(req: Request, res: Response): Promise<void> {
  const parsed = nuevoPuntoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'Los datos del punto no son válidos', detalles: parsed.error.flatten() } });
    return;
  }
  try {
    const punto = await crearEnServicio(res.locals.clienteSupabase, parsed.data, res.locals.modoEscritura);
    res.status(201).json({ datos: punto });
  } catch (error) {
    if (error instanceof DatosPuntoInvalidos) {
      res.status(400).json({ error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'La entidad o uno de los materiales no existen', detalles: null } });
      return;
    }
    if (error instanceof EscrituraDenegada) {
      res.status(403).json({ error: { codigo: 'ACCESO_DENEGADO', mensaje: 'No tienes permiso para modificar puntos', detalles: null } });
      return;
    }
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudo crear el punto', detalles: null } });
  }
}

export async function reactivarPunto(req: Request, res: Response): Promise<void> {
  const id = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(Number.MAX_SAFE_INTEGER)).safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'El número de punto no es válido', detalles: null } });
    return;
  }
  try {
    const punto = await reactivarEnServicio(res.locals.clienteSupabase, id.data, res.locals.modoEscritura);
    if (!punto) {
      res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Punto no encontrado', detalles: null } });
      return;
    }
    res.status(200).json({ datos: punto });
  } catch (error) {
    if (error instanceof EscrituraDenegada) {
      res.status(403).json({ error: { codigo: 'ACCESO_DENEGADO', mensaje: 'No tienes permiso para modificar puntos', detalles: null } });
      return;
    }
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudo reactivar el punto', detalles: null } });
  }
}

export async function desactivarPunto(req: Request, res: Response): Promise<void> {
  const id = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(Number.MAX_SAFE_INTEGER)).safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'El número de punto no es válido', detalles: null } });
    return;
  }
  try {
    const punto = await desactivarEnServicio(res.locals.clienteSupabase, id.data, res.locals.modoEscritura);
    if (!punto) {
      res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Punto no encontrado', detalles: null } });
      return;
    }
    res.status(200).json({ datos: punto });
  } catch (error) {
    if (error instanceof EscrituraDenegada) {
      res.status(403).json({ error: { codigo: 'ACCESO_DENEGADO', mensaje: 'No tienes permiso para modificar puntos', detalles: null } });
      return;
    }
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudo desactivar el punto', detalles: null } });
  }
}
