import type { Knex } from 'knex';
import { db } from '../../database/connection';
import type { AdminAuditRecord, AuditAction, AuditTargetType } from './admin.types';

export interface NewAuditEntry {
  id: string;
  adminId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata?: Record<string, unknown>;
}

// Owns the append-only `admin_audit_log` table.
export class AdminRepository {
  constructor(private readonly db: Knex) {}

  // Written inside the same transaction as the state change it records, so an
  // audit row can only exist if the change it describes actually committed.
  async recordAction(entry: NewAuditEntry, trx: Knex.Transaction): Promise<void> {
    await trx('admin_audit_log').insert({
      id: entry.id,
      admin_id: entry.adminId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
  }

  listActions(options: { limit: number; offset: number }): Promise<AdminAuditRecord[]> {
    return this.db<AdminAuditRecord>('admin_audit_log')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(options.limit)
      .offset(options.offset);
  }

  async count(): Promise<number> {
    const [row] = await this.db('admin_audit_log').count<{ n: number }[]>('id as n');
    return Number(row?.n ?? 0);
  }
}

export const adminRepository = new AdminRepository(db);
