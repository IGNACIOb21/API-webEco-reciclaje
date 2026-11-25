import { consultarEntidades } from '../repositories/entidades.repository';

export async function listarEntidades() {
  return consultarEntidades();
}
