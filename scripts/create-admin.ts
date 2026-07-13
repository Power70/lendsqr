import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { db } from '../src/database/connection';
import { isDuplicateEntry } from '../src/shared/utils/db-errors';

// Bootstraps an admin account. Admins are granted out-of-band on purpose — the
// public /users endpoint always creates `customer`, so it can never mint
// privileged accounts. Admins have no wallet (they never move money).
//
//   npm run create-admin -- <email> <phone> <bvn> <password> [first] [last]
//
// Phone/bvn satisfy the users table's NOT NULL + unique constraints; they are
// unused for admins. Password must be >= 8 chars.
const BCRYPT_COST = 12;

async function main(): Promise<void> {
  const [email, phone, bvn, password, firstName = 'Admin', lastName = 'User'] =
    process.argv.slice(2);

  if (!email || !phone || !bvn || !password) {
    console.error(
      'Usage: npm run create-admin -- <email> <phone> <bvn> <password> [first] [last]',
    );
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const id = randomUUID();

  try {
    await db('users').insert({
      id,
      email,
      phone,
      bvn,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role: 'admin',
    });
    console.log(`Admin created: ${email} (id ${id})`);
  } catch (err) {
    if (isDuplicateEntry(err)) {
      console.error('An account with that email, phone or BVN already exists.');
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

main()
  .catch((err: unknown) => {
    console.error('Failed to create admin:', err);
    process.exitCode = 1;
  })
  .finally(() => void db.destroy());
