import { Router } from 'express';
import { withTransaction } from '../../database/with-transaction';
import { authenticate } from '../../middleware/authenticate';
import { idempotency } from '../../middleware/idempotency';
import { validate } from '../../middleware/validate';
import { idempotencyRepository } from '../idempotency/idempotency.repository';
import { walletsRepository } from '../wallets/wallets.repository';
import { ledgerService } from './ledger.service';
import { TransactionsController } from './transactions.controller';
import { transactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';
import { TransferService } from './transfers.service';
import {
  listTransactionsQuerySchema,
  referenceParamsSchema,
  transferSchema,
} from './transactions.validators';

const transactionsController = new TransactionsController(
  new TransferService(withTransaction, walletsRepository, ledgerService, idempotencyRepository),
  new TransactionsService(transactionsRepository, walletsRepository),
);

export const transactionsRouter = Router();

transactionsRouter.use(authenticate);

transactionsRouter.post(
  '/transfer',
  validate(transferSchema),
  idempotency('transactions:transfer'),
  transactionsController.transfer,
);
transactionsRouter.get(
  '/',
  validate(listTransactionsQuerySchema, 'query'),
  transactionsController.list,
);
transactionsRouter.get(
  '/:reference',
  validate(referenceParamsSchema, 'params'),
  transactionsController.getByReference,
);
