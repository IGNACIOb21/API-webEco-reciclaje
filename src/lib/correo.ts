import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';

/** Solo en pruebas: los correos "enviados" quedan aquí para poder leer el código. */
export const bandejaDePrueba: { para: string; codigo: string }[] = [];

let transporte: Promise<Transporter> | undefined;

function crearTransporte(): Promise<Transporter> {
  if (config.NODE_ENV === 'test') return Promise.resolve(nodemailer.createTransport({ jsonTransport: true }));

  const tiempos = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 };
  if (config.SMTP_HOST) {
    return Promise.resolve(
      nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: config.SMTP_USER && config.SMTP_PASS ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
        ...tiempos,
      }),
    );
  }

  // Desarrollo sin SMTP: cuenta de Ethereal (correos de mentira, gratis y sin registro).
  return nodemailer.createTestAccount().then((c) =>
    nodemailer.createTransport({
      host: c.smtp.host,
      port: c.smtp.port,
      secure: c.smtp.secure,
      auth: { user: c.user, pass: c.pass },
      ...tiempos,
    }),
  );
}

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function enviarCodigoVerificacion(para: string, nombre: string, codigo: string, minutos: number) {
  if (config.NODE_ENV === 'test') bandejaDePrueba.push({ para, codigo });

  transporte ??= crearTransporte();
  let t: Transporter;
  try {
    t = await transporte;
  } catch (err) {
    transporte = undefined; // reintentar la próxima vez
    throw err;
  }

  const info = await t.sendMail({
    from: config.MAIL_FROM,
    to: para,
    subject: `${codigo} es tu código de Rebin`,
    text: `Hola ${nombre}, tu código de verificación de Rebin es ${codigo}. Vence en ${minutos} minutos. Si no creaste una cuenta, ignora este correo.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:420px;color:#14231c">
  <p>Hola ${escapar(nombre)},</p>
  <p>Tu código para verificar tu correo en Rebin es:</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:16px 0">${codigo}</p>
  <p>Vence en ${minutos} minutos. Si no creaste una cuenta, ignora este correo.</p>
</div>`,
  });

  const vista = nodemailer.getTestMessageUrl(info);
  if (vista) console.log(`Correo de prueba (Ethereal) para ${para}, ábrelo aquí: ${vista}`);
}
