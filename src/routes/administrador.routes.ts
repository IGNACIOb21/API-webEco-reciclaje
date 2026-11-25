import { Router } from 'express';
import { verificarAdministrador } from '../controllers/administrador.controller';

export const administradorRouter = Router();
administradorRouter.get('/admin/me', verificarAdministrador, (_req, res) => {
  res.status(200).json({ administrador: true, usuario: res.locals.administrador });
});
