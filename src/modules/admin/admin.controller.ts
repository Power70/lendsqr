import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import type { AdminService } from './admin.service';
import type {
  ListAuditQuery,
  ListUsersQuery,
  UpdateUserStatusInput,
  UpdateWalletStatusInput,
} from './admin.validators';

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  listUsers = asyncHandler(async (req, res) => {
    const { page, limit, status, role, search } = req.query as unknown as ListUsersQuery;
    const result = await this.adminService.listUsers({ page, limit, status, role, search });
    res.json(success(result));
  });

  getUser = asyncHandler(async (req, res) => {
    const user = await this.adminService.getUser(req.params.id as string);
    res.json(success(user));
  });

  updateUserStatus = asyncHandler(async (req, res) => {
    const { status, reason } = req.body as UpdateUserStatusInput;
    const user = await this.adminService.updateUserStatus({
      adminId: req.user!.id,
      userId: req.params.id as string,
      status,
      reason,
    });
    res.json(success(user));
  });

  updateWalletStatus = asyncHandler(async (req, res) => {
    const { status, reason } = req.body as UpdateWalletStatusInput;
    const wallet = await this.adminService.updateWalletStatus({
      adminId: req.user!.id,
      walletId: req.params.id as string,
      status,
      reason,
    });
    res.json(success(wallet));
  });

  getReconciliation = asyncHandler(async (_req, res) => {
    const report = await this.adminService.getReconciliation();
    res.json(success(report));
  });

  listAuditLog = asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as ListAuditQuery;
    const result = await this.adminService.listAuditLog({ page, limit });
    res.json(success(result));
  });
}
