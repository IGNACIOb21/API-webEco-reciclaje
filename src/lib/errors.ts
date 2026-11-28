/** Error con la forma que devuelve la API: { error: { codigo, mensaje, detalles } }. */
export class ErrorApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public detalles: Record<string, string[]> | null = null,
  ) {
    super(mensaje);
  }
}

export const conflicto = (codigo: string, mensaje: string) => new ErrorApi(409, codigo, mensaje);
export const noAutenticado = (mensaje = 'No autenticado') => new ErrorApi(401, 'NO_AUTENTICADO', mensaje);
export const prohibido = (mensaje = 'No tienes permiso') => new ErrorApi(403, 'PROHIBIDO', mensaje);
export const noEncontrado = (mensaje = 'No encontrado') => new ErrorApi(404, 'NO_ENCONTRADO', mensaje);
