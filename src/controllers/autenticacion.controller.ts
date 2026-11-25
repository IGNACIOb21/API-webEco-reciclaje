import { Request, Response } from 'express';
import { z } from 'zod';
import { AutorizacionDenegada, CredencialesInvalidas, iniciarSesion, refrescarSesion } from '../services/autenticacion.service';
import { modoEscritura } from '../config/modo-escritura';
import fs from 'node:fs';
import dotenv from 'dotenv';

const loginSchema = z.object({ email: z.email().max(150), password: z.string().min(1).max(1024) }).strict();
const refrescoSchema = z.object({ refresh_token: z.string().min(1).max(4096) }).strict();

function errorAuth(error: unknown, res: Response): void {
  if (error instanceof CredencialesInvalidas) {
    res.status(401).json({ error: { codigo: 'NO_AUTENTICADO', mensaje: 'Credenciales o sesión no válidas', detalles: null } });
  } else if (error instanceof AutorizacionDenegada) {
    res.status(403).json({ error: { codigo: 'ACCESO_DENEGADO', mensaje: 'Se requiere una cuenta de administrador activa', detalles: null } });
  } else {
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudo verificar la sesión', detalles: null } });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'Correo o contraseña no válidos', detalles: null } });
    return;
  }
  try { res.status(200).json({ datos: await iniciarSesion(parsed.data.email, parsed.data.password) }); }
  catch (error) { errorAuth(error, res); }
}

export async function refrescar(req: Request, res: Response): Promise<void> {
  res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
  const parsed = refrescoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { codigo: 'VALIDACION_INVALIDA', mensaje: 'Sesión de refresco no válida', detalles: null } });
    return;
  }
  try { res.status(200).json({ datos: await refrescarSesion(parsed.data.refresh_token) }); }
  catch (error) { errorAuth(error, res); }
}

// Cuenta ficticia disponible solo al navegador del mismo equipo y contra Supabase local.
export async function sesionLocal(req: Request, res: Response): Promise<void> {
  res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
  const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
  let mismoOrigen = false;
  try {
    const host = new URL(`http://${req.get('host')}`);
    const origin = new URL(req.get('origin') ?? '');
    mismoOrigen = !host.username && !host.password && ['localhost', '127.0.0.1'].includes(host.hostname) && origin.origin === host.origin;
  } catch { /* se rechaza si no se puede comprobar el origen */ }
  if (modoEscritura() !== 'local' || !loopback || !mismoOrigen || !req.is('application/json')) {
    res.status(403).json({ error: { codigo: 'ACCESO_DENEGADO', mensaje: 'Acceso de prueba no disponible', detalles: null } });
    return;
  }
  try {
    const cuenta = dotenv.parse(fs.readFileSync('.env.admin-local'));
    if (!cuenta.REBIN_ADMIN_LOCAL_EMAIL || !cuenta.REBIN_ADMIN_LOCAL_PASSWORD) throw new Error('Falta cuenta de prueba');
    res.status(200).json({ datos: await iniciarSesion(cuenta.REBIN_ADMIN_LOCAL_EMAIL, cuenta.REBIN_ADMIN_LOCAL_PASSWORD) });
  } catch {
    res.status(503).json({ error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'No se pudo iniciar la sesión de prueba', detalles: null } });
  }
}
