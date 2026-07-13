import { Router } from 'express';
import { db } from '../../database/connection';
import { withTransaction } from '../../database/with-transaction';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { reconcile } from '../transactions/reconciliation';
import { usersRepository } from '../users/users.repository';
import { walletsRepository } from '../wallets/wallets.repository';
import { AdminController } from './admin.controller';
import { adminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import {
  listAuditQuerySchema,
  listUsersQuerySchema,
  updateUserStatusSchema,
  updateWalletStatusSchema,
  userIdParamsSchema,
  walletIdParamsSchema,
} from './admin.validators';

const adminController = new AdminController(
  new AdminService(withTransaction, usersRepository, walletsRepository, adminRepository, () =>
    reconcile(db),
  ),
);

export const adminRouter = Router();

// Every admin route requires a valid token AND the admin role. Ordering
// matters: authenticate loads the fresh role, requireAdmin enforces it.
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/users', validate(listUsersQuerySchema, 'query'), adminController.listUsers);
adminRouter.get('/users/:id', validate(userIdParamsSchema, 'params'), adminController.getUser);
adminRouter.patch(
  '/users/:id/status',
  validate(userIdParamsSchema, 'params'),
  validate(updateUserStatusSchema),
  adminController.updateUserStatus,
);
adminRouter.patch(
  '/wallets/:id/status',
  validate(walletIdParamsSchema, 'params'),
  validate(updateWalletStatusSchema),
  adminController.updateWalletStatus,
);
adminRouter.get('/reconciliation', adminController.getReconciliation);
adminRouter.get('/audit-log', validate(listAuditQuerySchema, 'query'), adminController.listAuditLog);
