import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyMigrationService } from './key-migration.service';
import { CryptoService } from '../crypto/crypto.service';

describe('KeyMigrationService', () => {
  let crypto: CryptoService;
  const prisma = { llmConnection: { findMany: vi.fn(), update: vi.fn() } };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROVEIT_SECRET = 'a'.repeat(64);
    crypto = new CryptoService();
  });

  it('encrypts plaintext keys in place and sets hints', async () => {
    prisma.llmConnection.findMany.mockResolvedValue([{ id: 'c1', apiKey: 'sk-plain-1234' }]);
    await new KeyMigrationService(prisma as never, crypto).onModuleInit();
    const call = prisma.llmConnection.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'c1' });
    expect(crypto.decrypt(call.data.apiKey)).toBe('sk-plain-1234');
    expect(call.data.apiKeyHint).toBe('1234');
  });

  it('skips already-encrypted keys', async () => {
    prisma.llmConnection.findMany.mockResolvedValue([{ id: 'c2', apiKey: crypto.encrypt('sk-x') }]);
    await new KeyMigrationService(prisma as never, crypto).onModuleInit();
    expect(prisma.llmConnection.update).not.toHaveBeenCalled();
  });
});
