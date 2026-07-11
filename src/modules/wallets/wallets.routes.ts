import { Router } from 'express';
import { withTransaction } from '../../database/with-transaction';
import { authenticate } from '../../middleware/authenticate';
import { idempotency } from '../../middleware/idempotency';
import { validate } from '../../middleware/validate';
import { idempotencyRepository } from '../idempotency/idempotency.repository';
import { ledgerService } from '../transactions/ledger.service';
import { WalletsController } from './wallets.controller';
import { walletsRepository } from './wallets.repository';
import { WalletsService } from './wallets.service';
import { fundWalletSchema, withdrawSchema } from './wallets.validators';

const walletsController = new WalletsController(
  new WalletsService(withTransaction, walletsRepository, ledgerService, idempotencyRepository),
);

export const walletsRouter = Router();

walletsRouter.use(authenticate);

walletsRouter.get('/me', walletsController.getMe);
walletsRouter.post(
  '/fund',
  validate(fundWalletSchema),
  idempotency('wallets:fund'),
  walletsController.fund,
);
walletsRouter.post(
  '/withdraw',
  validate(withdrawSchema),
  idempotency('wallets:withdraw'),
  walletsController.withdraw,
);
