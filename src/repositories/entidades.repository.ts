import { supabase } from '../config/supabase';

export async function consultarEntidades() {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.from('entidad_administradora')
    .select('entidad_administradora_id,nombre_entidad,tipo_entidad')
    .order('nombre_entidad', { ascending: true })
    .limit(100)
    .abortSignal(AbortSignal.timeout(5000));
  if (error) throw new Error('No se pudieron consultar las entidades');
  return data;
}
