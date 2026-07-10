import { createUserSchema } from '../../src/modules/users/users.validators';

const validPayload = {
  email: 'ada@example.com',
  phone: '+2348012345678',
  bvn: '12345678901',
  password: 'correct-horse-9',
  first_name: 'Ada',
  last_name: 'Obi',
};

describe('createUserSchema', () => {
  it('accepts a valid payload', () => {
    const result = createUserSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('strips unknown keys so nothing unvalidated reaches the service', () => {
    const result = createUserSchema.parse({ ...validPayload, role: 'admin', balance: 999999 });
    expect(result).not.toHaveProperty('role');
    expect(result).not.toHaveProperty('balance');
  });

  it.each([
    ['invalid email', { email: 'not-an-email' }],
    ['phone without +234 prefix', { phone: '08012345678' }],
    ['phone with wrong length', { phone: '+23480123456789' }],
    ['bvn with 10 digits', { bvn: '1234567890' }],
    ['bvn with letters', { bvn: '1234567890a' }],
    ['password shorter than 8 chars', { password: 'short7!' }],
    ['password beyond bcrypt 72-byte limit', { password: 'x'.repeat(73) }],
    ['single-character first name', { first_name: 'A' }],
  ])('rejects %s', (_label, override) => {
    const result = createUserSchema.safeParse({ ...validPayload, ...override });
    expect(result.success).toBe(false);
  });

  it.each(['email', 'phone', 'bvn', 'password', 'first_name', 'last_name'])(
    'rejects a payload missing %s',
    (field) => {
      const payload: Record<string, unknown> = { ...validPayload };
      delete payload[field];
      expect(createUserSchema.safeParse(payload).success).toBe(false);
    },
  );
});
