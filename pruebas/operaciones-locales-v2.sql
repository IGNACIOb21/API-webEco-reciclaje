-- Exclusivo de la base ficticia local. No aplicar a la base compartida.
CREATE FUNCTION public.prueba_crear_punto_materiales(
  p_nombre text, p_direccion text, p_comuna text, p_latitud numeric, p_longitud numeric, p_materiales bigint[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_punto public.punto_reciclaje%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuario u
    JOIN public.usuario_rol ur ON ur.usuario_id = u.usuario_id
    JOIN public.rol r ON r.rol_id = ur.rol_id
    WHERE u.auth_id = auth.uid() AND u.activo AND r.nombre = 'administrador'
  ) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501'; END IF;
  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 OR length(p_nombre) > 100 OR
     p_direccion IS NULL OR length(trim(p_direccion)) = 0 OR length(p_direccion) > 200 OR
     p_comuna IS NULL OR length(trim(p_comuna)) = 0 OR length(p_comuna) > 60 OR
     p_latitud IS NULL OR p_latitud NOT BETWEEN -90 AND 90 OR
     p_longitud IS NULL OR p_longitud NOT BETWEEN -180 AND 180 OR
     p_materiales IS NULL OR cardinality(p_materiales) NOT BETWEEN 1 AND 25 OR
     (SELECT count(DISTINCT x) FROM unnest(p_materiales) AS x) <> cardinality(p_materiales) OR
     (SELECT count(*) FROM public.categoria_residuo WHERE categoria_residuo_id = ANY(p_materiales)) <> cardinality(p_materiales) THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.punto_reciclaje(nombre_punto, direccion_completa, comuna, coordenada_latitud, coordenada_longitud)
  VALUES (trim(p_nombre), trim(p_direccion), trim(p_comuna), p_latitud, p_longitud)
  RETURNING * INTO v_punto;
  INSERT INTO public.punto_categoria(punto_reciclaje_id, categoria_residuo_id)
    SELECT v_punto.punto_reciclaje_id, x FROM unnest(p_materiales) AS x;
  RETURN to_jsonb(v_punto) || jsonb_build_object('materiales', to_jsonb(p_materiales));
END;
$$;

CREATE FUNCTION public.prueba_reactivar_punto(p_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_punto public.punto_reciclaje%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuario u
    JOIN public.usuario_rol ur ON ur.usuario_id = u.usuario_id
    JOIN public.rol r ON r.rol_id = ur.rol_id
    WHERE u.auth_id = auth.uid() AND u.activo AND r.nombre = 'administrador'
  ) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501'; END IF;
  UPDATE public.punto_reciclaje SET estado_operativo = 'operativo'
    WHERE punto_reciclaje_id = p_id RETURNING * INTO v_punto;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_punto);
END;
$$;

-- Impedir que se use la función de prueba anterior para crear puntos sin materiales.
REVOKE ALL ON FUNCTION public.prueba_crear_punto(text,text,text,numeric,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prueba_crear_punto_materiales(text,text,text,numeric,numeric,bigint[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prueba_reactivar_punto(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prueba_crear_punto_materiales(text,text,text,numeric,numeric,bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prueba_reactivar_punto(bigint) TO authenticated;
