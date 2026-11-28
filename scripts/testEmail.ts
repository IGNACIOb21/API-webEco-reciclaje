import 'dotenv/config';
import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

console.log('SMTP_HOST:', SMTP_HOST);
console.log('SMTP_PORT:', SMTP_PORT);
console.log('SMTP_USER:', SMTP_USER ? `${SMTP_USER.slice(0, 4)}...${SMTP_USER.slice(-14)} (${SMTP_USER.length} caracteres)` : '(vacío)');
console.log('SMTP_PASS:', SMTP_PASS ? `${SMTP_PASS.slice(0, 8)}... (${SMTP_PASS.length} caracteres)` : '(vacío)');
console.log('MAIL_FROM:', MAIL_FROM);
console.log('');

const avisos: string[] = [];
if (!SMTP_USER || /PEGA|el-usuario|tucorreo/i.test(SMTP_USER)) avisos.push('SMTP_USER sigue con el texto de ejemplo.');
if (!SMTP_PASS || /PEGA|la-clave|clave-smtp/i.test(SMTP_PASS)) avisos.push('SMTP_PASS sigue con el texto de ejemplo.');
if (SMTP_USER && SMTP_HOST?.includes('brevo') && !SMTP_USER.endsWith('smtp-brevo.com')) {
  avisos.push('SMTP_USER no termina en @smtp-brevo.com: parece tu correo normal y debe ser el "login SMTP" de Brevo.');
}
if (SMTP_PASS?.startsWith('xkeysib')) {
  avisos.push('SMTP_PASS empieza con xkeysib: esa es una clave de API. Hay que generar una CLAVE SMTP (empieza con xsmtpsib).');
}
if (SMTP_USER && SMTP_USER !== SMTP_USER.trim()) avisos.push('SMTP_USER tiene espacios al inicio o al final.');
if (SMTP_PASS && SMTP_PASS !== SMTP_PASS.trim()) avisos.push('SMTP_PASS tiene espacios al inicio o al final.');
avisos.forEach((a) => console.log('AVISO:', a));

const t = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT ?? 587),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 10_000,
});
try {
  await t.verify();
  console.log('RESULTADO: Brevo aceptó el usuario y la clave. El envío debería funcionar.');
} catch (e) {
  console.log('RESULTADO: falló ->', (e as Error).message);
}