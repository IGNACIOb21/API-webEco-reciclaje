import { Router } from 'express';
import { salud } from '../controllers/salud.controller';

export const saludRouter = Router();
saludRouter.get('/salud', salud);
