import { clienteDeAutenticacion, clienteParaToken } from '../config/supabase';
import { tieneRolAdministrador } from '../repositories/administrador.repository';

export class CredencialesInvalidas extends Error {}
export class AutorizacionDenegada extends Error {}

async function verificarSesion(data: { access_token: string; refresh_token: string; expires_in: number; token_type: string; user: { id: string; is_anonymous?: boolean } }) {
  if (data.user.is_anonymous !== false) throw new AutorizacionDenegada();
  const cliente = clienteParaToken(data.access_token);
  if (!cliente) throw new Error('Supabase no configurado');
  if (!await tieneRolAdministrador(cliente, data.user.id)) throw new AutorizacionDenegada();
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, token_type: data.token_type };
}

export async function iniciarSesion(email: string, password: string) {
  const cliente = clienteDeAutenticacion();
  if (!cliente) throw new Error('Supabase no configurado');
  const { data, error } = await cliente.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) throw new CredencialesInvalidas();
    throw new Error('Servicio de autenticación no disponible');
  }
  if (!data.session) throw new CredencialesInvalidas();
  try { return await verificarSesion(data.session); }
  catch (error) {
    try { await cliente.auth.signOut({ scope: 'local' }); } catch { /* error de revocación no autoriza la sesión */ }
    throw error;
  }
}

export async function refrescarSesion(refreshToken: string) {
  const cliente = clienteDeAutenticacion();
  if (!cliente) throw new Error('Supabase no configurado');
  const { data, error } = await cliente.auth.refreshSession({ refresh_token: refreshToken });
  if (error) {
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) throw new CredencialesInvalidas();
    throw new Error('Servicio de autenticación no disponible');
  }
  if (!data.session) throw new CredencialesInvalidas();
  try { return await verificarSesion(data.session); }
  catch (error) {
    try { await cliente.auth.signOut({ scope: 'local' }); } catch { /* error de revocación no autoriza la sesión */ }
    throw error;
  }
}
