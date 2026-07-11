export type IdempotencyStatus = 'processing' | 'completed' | 'failed';

export interface ResponseSnapshot {
  status_code: number;
  body: unknown;
}

export interface IdempotencyRecord {
  id: string;
  user_id: string;
  idempotency_key: string;
  endpoint: string;
  status: IdempotencyStatus;
  request_hash: string;
  response_snapshot: ResponseSnapshot | null;
  transaction_id: string | null;
  created_at: Date;
  updated_at: Date;
}
