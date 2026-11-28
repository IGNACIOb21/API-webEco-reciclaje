import { z } from 'zod';

const correo = z
  .string({ required_error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .email('Correo inválido')
  .max(255);

const contrasena = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

const dispositivo = z.string().trim().min(1).max(255).optional();

export const registroSchema = z.object({
  nombre_usuario: z
    .string({ required_error: 'El nombre de usuario es obligatorio' })
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[\p{L}\p{N}_.-]+$/u, 'Solo letras, números, punto, guion y guion bajo'),
  correo_electronico: correo,
  contrasena,
  identificador_dispositivo: dispositivo,
});

export const loginSchema = z.object({
  correo_electronico: correo,
  // En el login no se exige el largo mínimo: solo que venga algo.
  contrasena: z.string({ required_error: 'La contraseña es obligatoria' }).min(1).max(128),
  identificador_dispositivo: dispositivo,
});

export const refreshSchema = z.object({
  refresh_token: z.string({ required_error: 'Falta refresh_token' }).min(20).max(200),
});

export const verificarSchema = z.object({
  correo_electronico: correo,
  codigo: z
    .string({ required_error: 'Escribe el código' })
    .trim()
    .regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
  identificador_dispositivo: dispositivo,
});

export const reenviarSchema = z.object({ correo_electronico: correo });

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerificarInput = z.infer<typeof verificarSchema>;
