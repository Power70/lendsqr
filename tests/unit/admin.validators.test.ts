import {
  listUsersQuerySchema,
  updateUserStatusSchema,
  updateWalletStatusSchema,
  userIdParamsSchema,
} from '../../src/modules/admin/admin.validators';

describe('admin validators', () => {
  describe('updateUserStatusSchema', () => {
    it('accepts a valid status with an optional reason', () => {
      const parsed = updateUserStatusSchema.parse({ status: 'suspended', reason: 'fraud' });
      expect(parsed).toEqual({ status: 'suspended', reason: 'fraud' });
    });

    it('accepts a status with no reason', () => {
      expect(updateUserStatusSchema.parse({ status: 'active' })).toEqual({ status: 'active' });
    });

    it('rejects a wallet status value on the user schema', () => {
      expect(updateUserStatusSchema.safeParse({ status: 'frozen' }).success).toBe(false);
    });

    it('rejects a blank reason', () => {
      expect(updateUserStatusSchema.safeParse({ status: 'active', reason: '   ' }).success).toBe(
        false,
      );
    });
  });

  describe('updateWalletStatusSchema', () => {
    it('accepts active/frozen', () => {
      expect(updateWalletStatusSchema.parse({ status: 'frozen' })).toEqual({ status: 'frozen' });
    });

    it('rejects a user status value', () => {
      expect(updateWalletStatusSchema.safeParse({ status: 'suspended' }).success).toBe(false);
    });
  });

  describe('listUsersQuerySchema', () => {
    it('applies defaults for page and limit', () => {
      expect(listUsersQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    });

    it('coerces numeric strings and keeps filters', () => {
      expect(listUsersQuerySchema.parse({ page: '2', limit: '50', status: 'active', search: 'x' })).toEqual(
        { page: 2, limit: 50, status: 'active', search: 'x' },
      );
    });

    it('rejects a limit above the cap', () => {
      expect(listUsersQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    });

    it('rejects an unknown role', () => {
      expect(listUsersQuerySchema.safeParse({ role: 'superuser' }).success).toBe(false);
    });
  });

  describe('userIdParamsSchema', () => {
    it('accepts a uuid', () => {
      expect(userIdParamsSchema.safeParse({ id: '11111111-1111-4111-8111-111111111111' }).success).toBe(
        true,
      );
    });

    it('rejects a non-uuid id', () => {
      expect(userIdParamsSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
    });
  });
});
