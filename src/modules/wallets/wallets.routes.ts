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
import { fundWalletSchema } from './wallets.validators';

const walletsController = new WalletsController(
  new WalletsService(withTransaction, walletsRepository, ledgerService, idempotencyRepository),
);

export const walletsRouter = Router();

walletsRouter.post(
  '/fund',
  authenticate,
  validate(fundWalletSchema),
  idempotency('wallets:fund'),
  walletsController.fund,
);
