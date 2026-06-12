import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$131072$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('right');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces unique hashes (random salt)', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
  });

  it('verifies using params embedded in the hash string', async () => {
    const { scryptSync, randomBytes } = await import('crypto');
    const salt = randomBytes(16);
    const dk = scryptSync('pw', salt, 32, { N: 16384, r: 8, p: 1 });
    const stored = `scrypt$16384$8$1$${salt.toString('base64')}$${dk.toString('base64')}`;
    expect(await verifyPassword('pw', stored)).toBe(true);
  });

  it('returns false on malformed stored hash', async () => {
    expect(await verifyPassword('pw', 'garbage')).toBe(false);
  });
});
