import { createClient } from '@supabase/supabase-js';

const mensaje = document.getElementById('mensaje') as HTMLParagraphElement;
const formulario = document.getElementById('formulario') as HTMLFormElement;
const clave = document.getElementById('clave') as HTMLInputElement;
const confirmacion = document.getElementById('confirmacion') as HTMLInputElement;
const recuperar = document.getElementById('recuperar') as HTMLFormElement;
const correo = document.getElementById('correo') as HTMLInputElement;

async function iniciar(): Promise<void> {
  const respuesta = await fetch('/config-publica', { cache: 'no-store' });
  if (!respuesta.ok) throw new Error('Falta configurar Supabase.');
  const config = await respuesta.json();
  const fragmento = new URLSearchParams(location.hash.slice(1));
  if (!fragmento.get('access_token') || !['invite', 'recovery'].includes(fragmento.get('type') ?? '')) {
    history.replaceState(null, '', location.pathname);
    mensaje.textContent = 'Puedes solicitar un enlace nuevo para configurar tu contraseña.';
    recuperar.hidden = false;
    recuperar.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const boton = recuperar.querySelector('button')!;
      boton.disabled = true;
      const clienteRecuperacion = createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' },
      });
      const { error } = await clienteRecuperacion.auth.resetPasswordForEmail(correo.value, { redirectTo: location.origin + '/' });
      mensaje.textContent = error
        ? 'No se pudo solicitar el correo. Espera un momento e inténtalo de nuevo.'
        : 'Si se puede enviar un correo a esa cuenta, recibirás un enlace. Revisa también correo no deseado.';
      boton.disabled = false;
    });
    return;
  }
  const cliente = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true },
  });
  const { data, error } = await cliente.auth.getSession();
  if (error || !data.session) throw new Error('El enlace ya no es válido o ha expirado.');
  history.replaceState(null, '', location.pathname);
  mensaje.textContent = 'Escribe una contraseña para terminar de configurar tu cuenta.';
  formulario.hidden = false;
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (clave.value !== confirmacion.value) {
      mensaje.textContent = 'Las contraseñas no coinciden. Inténtalo de nuevo.';
      return;
    }
    const boton = formulario.querySelector('button')!;
    boton.disabled = true;
    const { error: errorClave } = await cliente.auth.updateUser({ password: clave.value });
    if (errorClave) {
      mensaje.textContent = 'No se pudo guardar la contraseña. Comprueba que cumpla los requisitos e inténtalo de nuevo.';
      boton.disabled = false;
      return;
    }
    clave.value = '';
    confirmacion.value = '';
    formulario.hidden = true;
    mensaje.textContent = 'Tu contraseña se guardó. Ya puedes cerrar esta página.';
    await cliente.auth.signOut();
  });
}

iniciar().catch(() => {
  mensaje.textContent = 'No se pudo verificar la invitación. Puede haber vencido o faltar la configuración de Supabase.';
});
