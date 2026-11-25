import { supabase } from '../config/supabase';

export async function consultarPuntos(desde: number, limite: number) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('punto_reciclaje')
    .select('punto_reciclaje_id,nombre_punto,direccion_completa,comuna,coordenada_latitud,coordenada_longitud,estado_operativo,entidad_administradora_id')
    .order('punto_reciclaje_id', { ascending: true })
    .range(desde, desde + limite - 1)
    .abortSignal(AbortSignal.timeout(5000));
  if (error) throw new Error('No se pudieron consultar los puntos');
  return data;
}

export async function consultarPunto(id: number) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('punto_reciclaje')
    .select('punto_reciclaje_id,nombre_punto,direccion_completa,comuna,coordenada_latitud,coordenada_longitud,estado_operativo,entidad_administradora_id')
    .eq('punto_reciclaje_id', id)
    .abortSignal(AbortSignal.timeout(5000))
    .maybeSingle();
  if (error) throw new Error('No se pudo consultar el punto');
  return data;
}

export async function consultarMaterialesDelPunto(id: number) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('punto_reciclaje')
    .select('punto_reciclaje_id,punto_categoria(categoria_residuo(categoria_residuo_id,codigo,nombre_categoria,codigo_color))')
    .eq('punto_reciclaje_id', id)
    .abortSignal(AbortSignal.timeout(5000))
    .maybeSingle();
  if (error) throw new Error('No se pudieron consultar los materiales del punto');
  if (!data) return null;
  return data.punto_categoria.map((item: { categoria_residuo: unknown }) => item.categoria_residuo).filter(Boolean);
}
