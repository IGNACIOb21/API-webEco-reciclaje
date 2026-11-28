// Se ejecuta ANTES de cada archivo de pruebas: fija las variables para usar la base descartable.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@localhost:5432/rebin_test';
process.env.DB_SSL = 'false';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-de-al-menos-32-caracteres';
delete process.env.SMTP_HOST;
