// Consultas de datos con TanStack Query (caché, reintentos, estados de carga).
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { pedir } from '../services/api'
import type { CategoriaResiduo, FiltrosPuntos, Paginado, PuntoReciclaje } from './tipos'

export const claves = {
  puntos: (f: FiltrosPuntos) => ['puntos', f] as const,
  categorias: ['categorias'] as const,
}

export function usePuntos(filtros: FiltrosPuntos) {
  return useQuery({
    queryKey: claves.puntos(filtros),
    queryFn: () => pedir<Paginado<PuntoReciclaje>>('/admin/puntos', { consulta: { ...filtros } }),
    placeholderData: keepPreviousData,
  })
}

export function useCategorias() {
  return useQuery({
    queryKey: claves.categorias,
    queryFn: () => pedir<{ datos: CategoriaResiduo[] }>('/admin/categorias').then((r) => r.datos),
    staleTime: 10 * 60 * 1000,
  })
}
