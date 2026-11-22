import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { nuevoPuntoSchema } from '../validators/puntos.validator';
import { ModoEscritura } from '../config/modo-escritura';

export async function crearPuntoEnBase(cliente: SupabaseClient, punto: z.infer<typeof nuevoPuntoSchema>, modo: ModoEscritura) {
  const funcion = modo === 'local' ? 'prueba_crear_punto_con_entidad' : 'api_crear_punto';
  const { data, error } = await cliente.rpc(funcion, {
    p_nombre: punto.nombre_punto, p_direccion: punto.direccion_completa, p_comuna: punto.comuna,
    p_latitud: punto.coordenada_latitud, p_longitud: punto.coordenada_longitud,
    p_entidad: punto.entidad_administradora_id, p_materiales: punto.materiales,
  }).abortSignal(AbortSignal.timeout(5000));
  if (error?.code === '22023') throw new DatosPuntoInvalidos();
  if (error?.code === '42501') throw new EscrituraDenegada();
  if (error) throw new Error('Error al crear punto');
  return data;
}

export class DatosPuntoInvalidos extends Error {}
export class EscrituraDenegada extends Error {}

export async function reactivarPuntoEnBase(cliente: SupabaseClient, id: number, modo: ModoEscritura) {
  const { data, error } = await cliente.rpc(modo === 'local' ? 'prueba_reactivar_punto' : 'api_reactivar_punto', { p_id: id }).abortSignal(AbortSignal.timeout(5000));
  if (error?.code === '42501') throw new EscrituraDenegada();
  if (error) throw new Error('Error al reactivar punto');
  return data;
}

export async function desactivarPuntoEnBase(cliente: SupabaseClient, id: number, modo: ModoEscritura) {
  const { data, error } = await cliente.rpc(modo === 'local' ? 'prueba_desactivar_punto' : 'api_desactivar_punto', { p_id: id }).abortSignal(AbortSignal.timeout(5000));
  if (error?.code === '42501') throw new EscrituraDenegada();
  if (error) throw new Error('Error al desactivar punto');
  return data;
}
