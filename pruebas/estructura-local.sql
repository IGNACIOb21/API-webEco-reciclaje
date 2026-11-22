-- Esquema mínimo y ficticio para pruebas locales. No es una migración oficial.
-- Solo debe ejecutarse mediante scripts/preparar-base-local.cjs.
CREATE TABLE public.rol (
  rol_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  descripcion text
);
CREATE TABLE public.usuario (
  usuario_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  nombre_usuario text NOT NULL,
  activo boolean NOT NULL DEFAULT true
);
CREATE TABLE public.usuario_rol (
  usuario_id bigint NOT NULL REFERENCES public.usuario(usuario_id),
  rol_id bigint NOT NULL REFERENCES public.rol(rol_id),
  PRIMARY KEY (usuario_id, rol_id)
);
CREATE TABLE public.categoria_residuo (
  categoria_residuo_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo text UNIQUE,
  nombre_categoria text NOT NULL,
  codigo_color text,
  descripcion_categoria text,
  destino_reciclaje text
);
CREATE TABLE public.punto_reciclaje (
  punto_reciclaje_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_punto text NOT NULL,
  direccion_completa text,
  comuna text,
  coordenada_latitud numeric(9,6) NOT NULL,
  coordenada_longitud numeric(9,6) NOT NULL,
  estado_operativo text NOT NULL DEFAULT 'operativo'
    CHECK (estado_operativo IN ('operativo', 'lleno', 'mantenimiento', 'fuera_servicio'))
);
CREATE TABLE public.punto_categoria (
  punto_reciclaje_id bigint NOT NULL REFERENCES public.punto_reciclaje(punto_reciclaje_id),
  categoria_residuo_id bigint NOT NULL REFERENCES public.categoria_residuo(categoria_residuo_id),
  PRIMARY KEY (punto_reciclaje_id, categoria_residuo_id)
);

ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_rol ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punto_reciclaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categoria_residuo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punto_categoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usuario, public.usuario_rol, public.rol, public.punto_reciclaje, public.categoria_residuo, public.punto_categoria FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.punto_reciclaje, public.categoria_residuo, public.punto_categoria TO anon, authenticated;
GRANT SELECT ON public.usuario, public.usuario_rol, public.rol TO authenticated;
CREATE POLICY lectura_usuario_propio ON public.usuario FOR SELECT TO authenticated USING (auth_id = auth.uid());
CREATE POLICY lectura_roles_propios ON public.usuario_rol FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuario u WHERE u.usuario_id = usuario_rol.usuario_id AND u.auth_id = auth.uid()));
CREATE POLICY lectura_catalogo_roles ON public.rol FOR SELECT TO authenticated USING (true);
CREATE POLICY lectura_puntos ON public.punto_reciclaje FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lectura_materiales ON public.categoria_residuo FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lectura_punto_categoria ON public.punto_categoria FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.rol(nombre, descripcion) VALUES ('ciudadano', 'Rol de prueba'), ('administrador', 'Administrador de prueba');
INSERT INTO public.categoria_residuo(codigo,nombre_categoria,codigo_color,descripcion_categoria,destino_reciclaje) VALUES
  ('vidrio','Vidrio','#2E9E5B','Material de prueba','Reciclaje'),
  ('plastico','Plástico','#F2B705','Material de prueba','Reciclaje');
INSERT INTO public.punto_reciclaje(nombre_punto,direccion_completa,comuna,coordenada_latitud,coordenada_longitud,estado_operativo) VALUES
  ('Punto de prueba Norte','Dirección ficticia 100','Santiago',-33.437800,-70.650500,'operativo'),
  ('Punto de prueba Sur','Dirección ficticia 200','Santiago',-33.450000,-70.660000,'fuera_servicio');
INSERT INTO public.punto_categoria(punto_reciclaje_id,categoria_residuo_id) VALUES (1,1),(1,2),(2,1);
