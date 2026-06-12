import { describe, it, expect, beforeEach } from 'vitest';
import { CryptoService } from './crypto.service';

const SECRET = 'a'.repeat(64);

describe('CryptoService', () => {
  let svc: CryptoService;
  beforeEach(() => {
    process.env.PROVEIT_SECRET = SECRET;
    svc = new CryptoService();
  });

  it('round-trips plaintext', () => {
    const enc = svc.encrypt('sk-test-123');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(svc.decrypt(enc)).toBe('sk-test-123');
  });

  it('produces unique ciphertexts (random IV)', () => {
    expect(svc.encrypt('x')).not.toBe(svc.encrypt('x'));
  });

  it('detects tampering', () => {
    const enc = svc.encrypt('secret');
    const parts = enc.split(':');
    parts[4] = Buffer.from('tampered!').toString('base64');
    expect(() => svc.decrypt(parts.join(':'))).toThrow();
  });

  it('fails with wrong key', () => {
    const enc = svc.encrypt('secret');
    process.env.PROVEIT_SECRET = 'b'.repeat(64);
    expect(() => new CryptoService().decrypt(enc)).toThrow();
  });

  it('passes through non-encrypted values on decrypt', () => {
    expect(svc.decrypt('plain-key')).toBe('plain-key');
  });

  it('isEncrypted detects format', () => {
    expect(svc.isEncrypted(svc.encrypt('x'))).toBe(true);
    expect(svc.isEncrypted('plain')).toBe(false);
    expect(svc.isEncrypted(null)).toBe(false);
  });

  it('rejects missing/malformed secret at construction', () => {
    delete process.env.PROVEIT_SECRET;
    expect(() => new CryptoService()).toThrow(/PROVEIT_SECRET/);
    process.env.PROVEIT_SECRET = 'tooshort';
    expect(() => new CryptoService()).toThrow(/PROVEIT_SECRET/);
  });
});
