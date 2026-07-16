import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EvalSuiteVersionService } from './eval-suite-version.service';

/** CRUD for eval cases. Every mutation snapshots a new suite version. */
@Injectable()
export class EvalCaseService {
  constructor(
    private prisma: PrismaService,
    private suiteVersions: EvalSuiteVersionService,
  ) {}

  async addCases(pocId: string, cases: Array<{ name: string; input: unknown; judgeCriteria: string }>) {
    const existing = await this.prisma.evalCase.count({ where: { pocConfigId: pocId } });
    const created = await Promise.all(
      cases.map((c, i) =>
        this.prisma.evalCase.create({
          data: {
            pocConfigId: pocId,
            name: c.name,
            input: JSON.stringify(c.input),
            judgeCriteria: c.judgeCriteria,
            order: existing + i,
          },
        }),
      ),
    );
    await this.suiteVersions.createSnapshot(pocId);
    return { cases: created.map((c) => ({ ...c, input: JSON.parse(c.input) })) };
  }

  async updateCase(pocId: string, caseId: string, data: Partial<{ name: string; input: unknown; judgeCriteria: string; order: number }>) {
    const evalCase = await this.prisma.evalCase.findFirst({ where: { id: caseId, pocConfigId: pocId } });
    if (!evalCase) throw new NotFoundException('Eval case not found');
    const updated = await this.prisma.evalCase.update({
      where: { id: caseId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.input !== undefined && { input: JSON.stringify(data.input) }),
        ...(data.judgeCriteria !== undefined && { judgeCriteria: data.judgeCriteria }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
    await this.suiteVersions.createSnapshot(pocId);
    return { ...updated, input: JSON.parse(updated.input) };
  }

  async deleteCase(pocId: string, caseId: string) {
    const evalCase = await this.prisma.evalCase.findFirst({ where: { id: caseId, pocConfigId: pocId } });
    if (!evalCase) throw new NotFoundException('Eval case not found');
    await this.prisma.evalCase.delete({ where: { id: caseId } });
    await this.suiteVersions.createSnapshot(pocId);
  }
}
