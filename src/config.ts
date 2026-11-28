import 'dotenv/config';
import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'falta DATABASE_URL'),
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Correo (verificación de cuenta). Sin SMTP_HOST, en desarrollo se usa Ethereal (correos de mentira).
  SMTP_HOST: z.string().optional().transform((v) => v?.trim() || undefined),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().transform((v) => v?.trim() || undefined),
  SMTP_PASS: z.string().optional().transform((v) => v || undefined),
  MAIL_FROM: z.string().default('Rebin <no-reply@rebin.local>'),
});

const resultado = esquema.safeParse(process.env);

// Si falta algo, la API no arranca (F2-01).
if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`Configuración inválida. Revisa tu archivo .env:\n${problemas}`);
  process.exit(1);
}

// En producción los códigos tienen que llegar a correos reales: sin SMTP no se arranca.
if (resultado.data.NODE_ENV === 'production' && !resultado.data.SMTP_HOST) {
  console.error('Configuración inválida. Falta SMTP_HOST: en producción se necesita un servicio de correo (ver .env.example).');
  process.exit(1);
}

export const config = {
  ...resultado.data,
  corsOrigins: resultado.data.CORS_ORIGIN.split(',').map((o) => o.trim()),
};
