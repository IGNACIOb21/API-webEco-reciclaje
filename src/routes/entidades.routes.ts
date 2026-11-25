import { Router } from 'express';
import { obtenerEntidades } from '../controllers/entidades.controller';

export const entidadesRouter = Router();
entidadesRouter.get('/entidades', obtenerEntidades);
