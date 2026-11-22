import { consultarMateriales } from '../repositories/materiales.repository';

export async function listarMateriales() {
  return consultarMateriales();
}
