import { Router } from 'express';
import { withTransaction } from '../../database/with-transaction';
import { validate } from '../../middleware/validate';
import { tokenService } from '../auth/token.service';
import { karmaService } from '../karma/karma.service';
import { walletsRepository } from '../wallets/wallets.repository';
import { UsersController } from './users.controller';
import { usersRepository } from './users.repository';
import { UsersService } from './users.service';
import { createUserSchema } from './users.validators';

const usersController = new UsersController(
  new UsersService(withTransaction, usersRepository, walletsRepository, tokenService, karmaService),
);

export const usersRouter = Router();

usersRouter.post('/', validate(createUserSchema), usersController.signUp);
