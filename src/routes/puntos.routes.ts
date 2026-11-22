import { Router } from 'express';
import { obtenerMaterialesDelPunto, obtenerPunto, obtenerPuntos } from '../controllers/puntos.controller';
import { crearPunto, desactivarPunto, reactivarPunto } from '../controllers/puntos-escritura.controller';
import { permitirEscrituras } from '../middlewares/escrituras';
import { verificarAdministrador } from '../controllers/administrador.controller';

export const puntosRouter = Router();
puntosRouter.get('/puntos', obtenerPuntos);
puntosRouter.get('/puntos/:id/materiales', obtenerMaterialesDelPunto);
puntosRouter.get('/puntos/:id', obtenerPunto);
puntosRouter.post('/puntos', permitirEscrituras, verificarAdministrador, crearPunto);
puntosRouter.post('/puntos/:id/desactivar', permitirEscrituras, verificarAdministrador, desactivarPunto);
puntosRouter.post('/puntos/:id/reactivar', permitirEscrituras, verificarAdministrador, reactivarPunto);
