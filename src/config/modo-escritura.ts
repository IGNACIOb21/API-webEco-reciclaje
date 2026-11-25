export type ModoEscritura = 'local' | 'compartida';

// Se exige una activación explícita y un destino concreto para evitar escrituras accidentales.
export function modoEscritura(): ModoEscritura | null {
  try {
    const url = new URL(process.env.SUPABASE_URL ?? '');
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (process.env.REBIN_ESCRITURAS_LOCALES === 'true' && url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '54321') return 'local';
    if (process.env.REBIN_ESCRITURAS_COMPARTIDAS === 'true' && url.protocol === 'https:' &&
        url.hostname === 'shkdlkbhpkbrfxemctdj.supabase.co' && !url.port) return 'compartida';
  } catch { /* URL inválida: se rechaza la escritura */ }
  return null;
}
