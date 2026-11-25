import { supabase } from '../config/supabase';

export async function comprobarAccesoPuntos(): Promise<boolean> {
  if (!supabase) return false;
  try {
    // No se devuelven filas al solicitante. La tabla debe estar expuesta y ser legible.
    const { error } = await supabase.from('punto_reciclaje').select('punto_reciclaje_id').limit(1).abortSignal(AbortSignal.timeout(5000));
    return !error;
  } catch {
    return false;
  }
}
