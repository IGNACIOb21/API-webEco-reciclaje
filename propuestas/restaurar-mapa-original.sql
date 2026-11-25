-- Copia de respaldo para revisión; no se ha ejecutado.
CREATE OR REPLACE FUNCTION public.app_puntos_cercanos(p_lat double precision, p_lng double precision, radio_km double precision DEFAULT 10, comuna_filtro text DEFAULT NULL::text, materiales_filtro text[] DEFAULT NULL::text[], solo_disponibles boolean DEFAULT false, calificacion_minima double precision DEFAULT 0)
 RETURNS TABLE(id text, nombre text, comuna text, direccion text, lat double precision, lng double precision, fuente text, materiales text[], estado_actual text, calificacion_promedio double precision, num_calificaciones integer, avisos text[], distancia_km double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with base as (
    select
      p.punto_reciclaje_id,
      p.nombre_punto,
      p.comuna as comuna_punto,
      p.direccion_completa,
      p.coordenada_latitud::float8 as plat,
      p.coordenada_longitud::float8 as plng,
      p.osm_id,
      p.estado_operativo,
      2 * 6371 * asin(sqrt(
        power(sin(radians(p.coordenada_latitud::float8 - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(p.coordenada_latitud::float8))
        * power(sin(radians(p.coordenada_longitud::float8 - p_lng) / 2), 2)
      )) as dist
    from punto_reciclaje p
    where p.estado_operativo <> 'fuera_servicio'
       or not coalesce(solo_disponibles, false)
  ),
  detalle as (
    select
      b.*,
      coalesce((
        select array_agg(c.codigo::text order by c.codigo)
          from punto_categoria pc
          join categoria_residuo c on c.categoria_residuo_id = pc.categoria_residuo_id
         where pc.punto_reciclaje_id = b.punto_reciclaje_id
           and c.codigo is not null
      ), '{}') as mats,
      (select avg(cp.puntuacion)::float8 from calificacion_punto cp
        where cp.punto_reciclaje_id = b.punto_reciclaje_id) as prom,
      (select count(*)::int from calificacion_punto cp
        where cp.punto_reciclaje_id = b.punto_reciclaje_id) as n
    from base b
    where b.dist <= coalesce(radio_km, 10)
      and (comuna_filtro is null or b.comuna_punto = comuna_filtro)
      and (not coalesce(solo_disponibles, false) or b.estado_operativo = 'operativo')
  )
  select
    d.punto_reciclaje_id::text,
    d.nombre_punto::text,
    d.comuna_punto::text,
    d.direccion_completa,
    d.plat,
    d.plng,
    case when d.osm_id is null then 'oficial' else 'osm' end,
    d.mats,
    case d.estado_operativo::text
      when 'operativo' then 'disponible'
      when 'lleno' then 'lleno'
      when 'mantenimiento' then 'mal_mantenimiento'
      else 'fuera_de_uso'
    end,
    coalesce(d.prom, 0),
    d.n,
    '{}'::text[],
    d.dist
  from detalle d
  where (materiales_filtro is null or d.mats && materiales_filtro)
    and coalesce(d.prom, 0) >= coalesce(calificacion_minima, 0)
  order by d.dist
  limit 300
$function$
