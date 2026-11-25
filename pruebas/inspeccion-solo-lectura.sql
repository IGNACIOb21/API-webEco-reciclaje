-- Auditoría de estructura y permisos. Solo lee metadatos; no consulta datos personales.
SELECT table_name, column_name, data_type, udt_name, is_nullable,
       column_default IS NOT NULL AS tiene_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('usuario', 'usuario_rol', 'rol', 'punto_reciclaje', 'punto_categoria', 'categoria_residuo')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS tabla, c.relrowsecurity AS rls,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS lectura,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS insercion,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS actualizacion,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS borrado
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('usuario', 'usuario_rol', 'rol', 'punto_reciclaje', 'punto_categoria', 'categoria_residuo')
ORDER BY c.relname;

SELECT tablename, policyname, cmd, roles
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('usuario', 'usuario_rol', 'rol', 'punto_reciclaje', 'punto_categoria', 'categoria_residuo')
ORDER BY tablename, policyname;

SELECT p.proname AS funcion, pg_get_function_identity_arguments(p.oid) AS argumentos,
       p.prosecdef AS privilegios_elevados,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND (p.proname ILIKE '%rol%' OR p.proname ILIKE '%punto%' OR p.proname ILIKE '%auth%' OR p.proname ILIKE '%usuario%')
ORDER BY p.proname;
