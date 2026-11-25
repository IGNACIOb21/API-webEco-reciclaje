import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { nuevoPuntoSchema } from '../validators/puntos.validator';
import { crearPuntoEnBase, desactivarPuntoEnBase, reactivarPuntoEnBase } from '../repositories/puntos-escritura.repository';
import { ModoEscritura } from '../config/modo-escritura';

export const crearPunto = (cliente: SupabaseClient, punto: z.infer<typeof nuevoPuntoSchema>, modo: ModoEscritura) => crearPuntoEnBase(cliente, punto, modo);
export const desactivarPunto = (cliente: SupabaseClient, id: number, modo: ModoEscritura) => desactivarPuntoEnBase(cliente, id, modo);
export const reactivarPunto = (cliente: SupabaseClient, id: number, modo: ModoEscritura) => reactivarPuntoEnBase(cliente, id, modo);
