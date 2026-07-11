import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import type { WalletsService } from './wallets.service';
import type { FundWalletInput } from './wallets.validators';

export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  fund = asyncHandler(async (req, res) => {
    const { amount, narration } = req.body as FundWalletInput;
    const result = await this.walletsService.fund({
      userId: req.user!.id,
      amount,
      narration,
      idempotencyRecordId: req.idempotency!.recordId,
    });
    res.status(201).json(success(result));
  });
}
