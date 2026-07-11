import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import type { WalletsService } from './wallets.service';
import type { FundWalletInput, WithdrawInput } from './wallets.validators';

export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  getMe = asyncHandler(async (req, res) => {
    const wallet = await this.walletsService.getForUser(req.user!.id);
    res.json(
      success({
        id: wallet.id,
        balance: wallet.balance,
        currency: wallet.currency,
        status: wallet.status,
      }),
    );
  });

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

  withdraw = asyncHandler(async (req, res) => {
    const { amount, bank_code, account_number, narration } = req.body as WithdrawInput;
    const result = await this.walletsService.withdraw({
      userId: req.user!.id,
      amount,
      bankCode: bank_code,
      accountNumber: account_number,
      narration,
      idempotencyRecordId: req.idempotency!.recordId,
    });
    res.status(201).json(success(result));
  });
}
