import { crearApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const app = crearApp();
const servidor = app.listen(config.PORT, () => {
  console.log(`API de Rebin lista en http://localhost:${config.PORT}  (salud: /salud)`);
});

const apagar = () => {
  servidor.close(() => void pool.end().finally(() => process.exit(0)));
};
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
