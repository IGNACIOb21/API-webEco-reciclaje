import { consultarMaterialesDelPunto, consultarPunto, consultarPuntos } from '../repositories/puntos.repository';

export async function listarPuntos(pagina: number, limite: number) {
  return consultarPuntos((pagina - 1) * limite, limite);
}

export async function buscarPunto(id: number) {
  return consultarPunto(id);
}

export async function buscarMaterialesDelPunto(id: number) {
  return consultarMaterialesDelPunto(id);
}
