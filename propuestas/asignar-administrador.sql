-- Referencia de la asignación autorizada el 21-11-2026. No ejecutar sin revisar la cuenta destinataria.
-- $1 es el correo de la cuenta de Supabase Auth que se autorizará.
-- Debe ejecutarse dentro de una transacción y comprobar que cuentas=1.
WITH candidatos AS (
  SELECT u.usuario_id
  FROM public.usuario u
  JOIN auth.users a ON a.id = u.auth_id
  WHERE lower(a.email) = lower($1::text)
    AND a.email_confirmed_at IS NOT NULL
    AND a.is_anonymous IS FALSE
    AND u.activo IS TRUE
), unico AS (
  SELECT min(usuario_id) AS usuario_id FROM candidatos HAVING count(*) = 1
), insercion AS (
  INSERT INTO public.usuario_rol(usuario_id, rol_id)
  SELECT unico.usuario_id, r.rol_id FROM unico CROSS JOIN public.rol r
  WHERE r.nombre = 'administrador'
  ON CONFLICT (usuario_id, rol_id) DO NOTHING
  RETURNING 1
)
SELECT (SELECT count(*) FROM unico)::integer AS cuentas,
       (SELECT count(*) FROM public.rol WHERE nombre = 'administrador')::integer AS roles_administrador,
       (SELECT count(*) FROM insercion)::integer AS asignaciones;
