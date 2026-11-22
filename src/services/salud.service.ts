import { comprobarAccesoPuntos } from '../repositories/salud.repository';

export async function estadoDeDatos(): Promise<boolean> {
  return comprobarAccesoPuntos();
}
