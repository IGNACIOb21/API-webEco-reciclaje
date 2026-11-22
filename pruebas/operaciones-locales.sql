-- Exclusivamente para la base local ficticia. No aplicar en Supabase compartido.
CREATE FUNCTION public.prueba_crear_punto(
  p_nombre text, p_direccion text, p_comuna text, p_latitud numeric, p_longitud numeric
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
     p_longitud IS NULL OR p_longitud NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.punto_reciclaje(nombre_punto, direccion_completa, comuna, coordenada_latitud, coordenada_longitud)
  VALUES (trim(p_nombre), trim(p_direccion), trim(p_comuna), p_latitud, p_longitud)
  RETURNING * INTO v_punto;
  RETURN to_jsonb(v_punto);
END;
$$;

CREATE FUNCTION public.prueba_desactivar_punto(p_id bigint) RETURNS jsonb
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
  UPDATE public.punto_reciclaje SET estado_operativo = 'fuera_servicio'
    WHERE punto_reciclaje_id = p_id RETURNING * INTO v_punto;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_punto);
END;
$$;

REVOKE ALL ON FUNCTION public.prueba_crear_punto(text,text,text,numeric,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prueba_desactivar_punto(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prueba_crear_punto(text,text,text,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prueba_desactivar_punto(bigint) TO authenticated;
