import { Router } from 'express';
import { obtenerMateriales } from '../controllers/materiales.controller';

export const materialesRouter = Router();
materialesRouter.get('/materiales', obtenerMateriales);
