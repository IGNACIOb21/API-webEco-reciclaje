import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const usuarioConRoles = z.object({
  activo: z.boolean().nullable(),
  usuario_rol: z.array(z.object({ rol: z.object({ nombre: z.string() }).nullable() })),
});

export async function tieneRolAdministrador(cliente: SupabaseClient, authId: string): Promise<boolean> {
  const { data, error } = await cliente.from('usuario')
    .select('activo, usuario_rol(rol(nombre))')
    .eq('auth_id', authId)
    .maybeSingle();
  if (error) throw new Error('No se pudo consultar el rol');
  if (!data) return false;
  const parsed = usuarioConRoles.safeParse(data);
  if (!parsed.success) throw new Error('Respuesta de roles no compatible con el esquema esperado');
  return parsed.data.activo === true && parsed.data.usuario_rol.some(item => item.rol?.nombre === 'administrador');
}
