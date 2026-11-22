-- Solo para el entorno ficticio local. No aplicar a la base compartida.
CREATE TABLE public.entidad_administradora (
  entidad_administradora_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_entidad varchar(100) NOT NULL,
  tipo_entidad text NOT NULL
);
ALTER TABLE public.entidad_administradora ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.entidad_administradora FROM anon, authenticated;
GRANT SELECT ON public.entidad_administradora TO anon, authenticated;
CREATE POLICY lectura_entidades ON public.entidad_administradora FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.entidad_administradora(nombre_entidad, tipo_entidad) VALUES ('Entidad de prueba', 'organizacion');
ALTER TABLE public.punto_reciclaje ADD COLUMN entidad_administradora_id integer;
UPDATE public.punto_reciclaje SET entidad_administradora_id = 1;
ALTER TABLE public.punto_reciclaje ALTER COLUMN entidad_administradora_id SET NOT NULL;
ALTER TABLE public.punto_reciclaje ADD CONSTRAINT punto_entidad_local_fk
  FOREIGN KEY (entidad_administradora_id) REFERENCES public.entidad_administradora(entidad_administradora_id);

CREATE FUNCTION public.prueba_crear_punto_con_entidad(
  p_nombre text, p_direccion text, p_comuna text, p_latitud numeric, p_longitud numeric,
  p_entidad integer, p_materiales bigint[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_punto public.punto_reciclaje%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuario u JOIN public.usuario_rol ur ON ur.usuario_id = u.usuario_id
    JOIN public.rol r ON r.rol_id = ur.rol_id
    WHERE u.auth_id = auth.uid() AND u.activo AND r.nombre = 'administrador'
  ) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501'; END IF;
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

REVOKE ALL ON FUNCTION public.prueba_crear_punto_materiales(text,text,text,numeric,numeric,bigint[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prueba_crear_punto_con_entidad(text,text,text,numeric,numeric,integer,bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prueba_crear_punto_con_entidad(text,text,text,numeric,numeric,integer,bigint[]) TO authenticated;
