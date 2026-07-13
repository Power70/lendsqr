export type UserStatus = 'active' | 'suspended';
export type UserRole = 'customer' | 'admin';

// Row shape of the `users` table
export interface UserRecord {
  id: string;
  email: string;
  phone: string;
  bvn: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export interface NewUserRow {
  id: string;
  email: string;
  phone: string;
  bvn: string;
  password_hash: string;
  first_name: string;
  last_name: string;
}

// What the API is allowed to return — never password_hash or bvn
export interface PublicUser {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
}

export function toPublicUser(user: UserRecord | NewUserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    first_name: user.first_name,
    last_name: user.last_name,
  };
}
