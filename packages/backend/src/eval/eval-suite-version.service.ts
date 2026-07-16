import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Snapshots the eval-case suite so runs stay attributable to the suite they ran against. */
@Injectable()
export class EvalSuiteVersionService {
  constructor(private prisma: PrismaService) {}

  async createSnapshot(pocId: string): Promise<void> {
    const [cases, latest] = await Promise.all([
      this.prisma.evalCase.findMany({
        where: { pocConfigId: pocId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.evalSuiteVersion.findFirst({
        where: { pocConfigId: pocId },
        orderBy: { versionNumber: 'desc' },
      }),
    ]);

    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const casesSnapshot = JSON.stringify(
      cases.map((c) => ({
        id: c.id,
        name: c.name,
        input: c.input,
        judgeCriteria: c.judgeCriteria,
        order: c.order,
      })),
    );

    await this.prisma.evalSuiteVersion.create({
      data: { pocConfigId: pocId, versionNumber, casesSnapshot },
    });
  }

  async listVersions(pocId: string) {
    const versions = await this.prisma.evalSuiteVersion.findMany({
      where: { pocConfigId: pocId },
      orderBy: { versionNumber: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
    return versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      casesSnapshot: JSON.parse(v.casesSnapshot) as unknown[],
      createdAt: v.createdAt.toISOString(),
      runCount: v._count.runs,
    }));
  }
}
