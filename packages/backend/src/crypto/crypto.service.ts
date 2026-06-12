import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.PROVEIT_SECRET;
    if (!secret || !/^[0-9a-fA-F]{64}$/.test(secret)) {
      throw new Error(
        'PROVEIT_SECRET must be set to 64 hex characters (32 bytes). Generate one with:\n' +
          '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    this.key = Buffer.from(secret, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  /** Decrypts enc:v1 values; passes through anything else (legacy plaintext). */
  decrypt(stored: string): string {
    if (!this.isEncrypted(stored)) return stored;
    const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  }

  isEncrypted(value: string | null | undefined): boolean {
    return !!value && value.startsWith(PREFIX);
  }
}
