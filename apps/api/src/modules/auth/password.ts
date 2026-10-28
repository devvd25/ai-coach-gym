import bcrypt from 'bcryptjs';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

/** Cost 12 in production; tests pass a low cost so the suite stays fast. */
export function createPasswordHasher(cost = 12): PasswordHasher {
  return {
    hash: (password) => bcrypt.hash(password, cost),
    compare: (password, hash) => bcrypt.compare(password, hash),
  };
}
