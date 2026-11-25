import { z } from 'zod';

// El alta requiere una entidad y al menos un material válido.
export const nuevoPuntoSchema = z.object({
  nombre_punto: z.string().trim().min(1).max(100),
  direccion_completa: z.string().trim().min(1).max(200),
  comuna: z.string().trim().min(1).max(60),
  coordenada_latitud: z.number().finite().min(-90).max(90),
  coordenada_longitud: z.number().finite().min(-180).max(180),
  entidad_administradora_id: z.number().int().positive().max(2147483647),
  materiales: z.array(z.number().int().positive().max(2147483647)).min(1).max(25)
    .refine(ids => new Set(ids).size === ids.length, 'No se pueden repetir materiales'),
}).strict();
