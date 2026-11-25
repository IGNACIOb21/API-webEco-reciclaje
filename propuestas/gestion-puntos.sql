-- Referencia de las funciones aplicadas el 21-11-2026. No ejecutar nuevamente sin revisar el estado de la base.
-- Requiere: usuario.auth_id, usuario.activo, usuario_rol, rol.nombre y Supabase Auth.
-- Las cuentas administradoras existentes sin auth_id no podrán usar estas funciones hasta acordar una integración.
BEGIN;

CREATE FUNCTION public.api_exigir_administrador() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.usuario u
  JOIN public.usuario_rol ur ON ur.usuario_id = u.usuario_id
  JOIN public.rol r ON r.rol_id = ur.rol_id
  WHERE u.auth_id = auth.uid() AND u.activo IS TRUE AND r.nombre = 'administrador'
  FOR SHARE OF u, ur, r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.api_exigir_administrador() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.api_crear_punto(
  p_nombre text, p_direccion text, p_comuna text, p_latitud numeric, p_longitud numeric,
  p_entidad integer, p_materiales integer[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_punto public.punto_reciclaje%ROWTYPE;
BEGIN
  PERFORM public.api_exigir_administrador();
  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 OR length(p_nombre) > 100 OR
     p_direccion IS NULL OR length(trim(p_direccion)) = 0 OR length(p_direccion) > 200 OR
     p_comuna IS NULL OR length(trim(p_comuna)) = 0 OR length(p_comuna) > 60 OR
     p_latitud IS NULL OR p_latitud NOT BETWEEN -90 AND 90 OR
     p_longitud IS NULL OR p_longitud NOT BETWEEN -180 AND 180 OR
     p_entidad IS NULL OR NOT EXISTS (SELECT 1 FROM public.entidad_administradora WHERE entidad_administradora_id = p_entidad) OR
     p_materiales IS NULL OR cardinality(p_materiales) NOT BETWEEN 1 AND 25 OR
     (SELECT count(DISTINCT x) FROM unnest(p_materiales) AS x) <> cardinality(p_materiales) OR
     (SELECT count(*) FROM public.categoria_residuo WHERE categoria_residuo_id = ANY(p_materiales)) <> cardinality(p_materiales) THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.punto_reciclaje(nombre_punto,direccion_completa,comuna,coordenada_latitud,coordenada_longitud,entidad_administradora_id)
  VALUES (trim(p_nombre),trim(p_direccion),trim(p_comuna),p_latitud,p_longitud,p_entidad)
  RETURNING * INTO v_punto;
  INSERT INTO public.punto_categoria(punto_reciclaje_id,categoria_residuo_id)
    SELECT v_punto.punto_reciclaje_id,x FROM unnest(p_materiales) AS x;
  RETURN to_jsonb(v_punto) || jsonb_build_object('materiales',to_jsonb(p_materiales));
END;
$$;

CREATE FUNCTION public.api_desactivar_punto(p_id integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_punto public.punto_reciclaje%ROWTYPE;
BEGIN
  PERFORM public.api_exigir_administrador();
  UPDATE public.punto_reciclaje SET estado_operativo = 'fuera_servicio'
    WHERE punto_reciclaje_id = p_id RETURNING * INTO v_punto;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_punto);
END;
$$;

CREATE FUNCTION public.api_reactivar_punto(p_id integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_punto public.punto_reciclaje%ROWTYPE;
BEGIN
  PERFORM public.api_exigir_administrador();
  UPDATE public.punto_reciclaje SET estado_operativo = 'operativo'
    WHERE punto_reciclaje_id = p_id AND estado_operativo = 'fuera_servicio' RETURNING * INTO v_punto;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_punto);
END;
$$;

REVOKE ALL ON FUNCTION public.api_crear_punto(text,text,text,numeric,numeric,integer,integer[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_desactivar_punto(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_reactivar_punto(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_crear_punto(text,text,text,numeric,numeric,integer,integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_desactivar_punto(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_reactivar_punto(integer) TO authenticated;
COMMIT;
