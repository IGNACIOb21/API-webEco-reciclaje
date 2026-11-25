import { Router } from 'express';
import { login, refrescar, sesionLocal } from '../controllers/autenticacion.controller';

export const autenticacionRouter = Router();
autenticacionRouter.post('/auth/login', login);
autenticacionRouter.post('/auth/refrescar', refrescar);
autenticacionRouter.post('/auth/sesion-local', sesionLocal);
