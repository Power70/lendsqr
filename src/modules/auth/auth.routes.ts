import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { usersRepository } from '../users/users.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { loginSchema } from './auth.validators';
import { tokenService } from './token.service';

const authController = new AuthController(new AuthService(usersRepository, tokenService));

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), authController.login);
