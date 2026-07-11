import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import type { TransactionsService } from './transactions.service';
import type { TransferService } from './transfers.service';
import type { ListTransactionsQuery, TransferInput } from './transactions.validators';

export class TransactionsController {
  constructor(
    private readonly transferService: TransferService,
    private readonly transactionsService: TransactionsService,
  ) {}

  transfer = asyncHandler(async (req, res) => {
    const { recipient_wallet_id, amount, narration } = req.body as TransferInput;
    const result = await this.transferService.transfer({
      userId: req.user!.id,
      recipientWalletId: recipient_wallet_id,
      amount,
      narration,
      idempotencyRecordId: req.idempotency!.recordId,
    });
    res.status(201).json(success(result));
  });

  list = asyncHandler(async (req, res) => {
    const { limit, cursor } = req.query as unknown as ListTransactionsQuery;
    const page = await this.transactionsService.listForUser(req.user!.id, { limit, cursor });
    res.json(success(page));
  });

  getByReference = asyncHandler(async (req, res) => {
    const item = await this.transactionsService.getByReferenceForUser(
      req.user!.id,
      req.params.reference as string,
    );
    res.json(success(item));
  });
}
