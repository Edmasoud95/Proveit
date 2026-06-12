import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class KeyMigrationService implements OnModuleInit {
  private readonly logger = new Logger(KeyMigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async onModuleInit(): Promise<void> {
    const conns = await this.prisma.llmConnection.findMany({
      where: { apiKey: { not: null } },
      select: { id: true, apiKey: true },
    });
    const plaintext = conns.filter((c) => c.apiKey && !this.crypto.isEncrypted(c.apiKey));
    for (const conn of plaintext) {
      await this.prisma.llmConnection.update({
        where: { id: conn.id },
        data: { apiKey: this.crypto.encrypt(conn.apiKey!), apiKeyHint: conn.apiKey!.slice(-4) },
      });
    }
    if (plaintext.length > 0) {
      this.logger.log(`Encrypted ${plaintext.length} plaintext API key(s)`);
    }
  }
}
