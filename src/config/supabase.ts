import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const settings = z.object({
  SUPABASE_URL: z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  }),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
}).safeParse(process.env);

// Sin credenciales válidas, el servidor sigue disponible y salud informa 503.
export const supabase: SupabaseClient | null = settings.success
  ? createClient(settings.data.SUPABASE_URL, settings.data.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// Un cliente por solicitud evita compartir la sesión entre usuarios.
export function clienteParaToken(token: string): SupabaseClient | null {
  if (!settings.success) return null;
  return createClient(settings.data.SUPABASE_URL, settings.data.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// La autenticación nunca comparte estado de sesión entre solicitudes.
export function clienteDeAutenticacion(): SupabaseClient | null {
  if (!settings.success) return null;
  return createClient(settings.data.SUPABASE_URL, settings.data.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
