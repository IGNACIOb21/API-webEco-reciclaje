import { supabase } from '../config/supabase';

export async function consultarMateriales() {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.from('categoria_residuo')
    .select('categoria_residuo_id,codigo,nombre_categoria,codigo_color,descripcion_categoria,destino_reciclaje')
    .order('nombre_categoria', { ascending: true })
    .limit(100)
    .abortSignal(AbortSignal.timeout(5000));
  if (error) throw new Error('No se pudieron consultar los materiales');
  return data;
}
