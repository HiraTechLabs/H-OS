import { eq } from 'drizzle-orm';
import type { DbExecutor } from '@h-os/kernel';
import type { EmploymentRepository } from '../application/ports.js';
import type { EmploymentStatus } from '../domain/employment-status.js';
import { employmentContract, employmentEpisode, employeeStatusTransition } from './schema.js';

export class DrizzleEmploymentRepository implements EmploymentRepository {
  async insertEpisode(
    executor: DbExecutor,
    episode: {
      id: string;
      organizationId: string;
      employeeId: string;
      episodeNo: number;
      employmentType: string;
      startDate: string;
      endDate: string | null;
      probationEndDate: string | null;
    },
  ): Promise<void> {
    await executor.insert(employmentEpisode).values({
      id: episode.id,
      organizationId: episode.organizationId,
      employeeId: episode.employeeId,
      episodeNo: episode.episodeNo,
      employmentType: episode.employmentType as typeof employmentEpisode.$inferInsert.employmentType,
      startDate: episode.startDate,
      endDate: episode.endDate,
      probationEndDate: episode.probationEndDate,
    });
  }

  async addContract(
    executor: DbExecutor,
    contract: {
      id: string;
      organizationId: string;
      episodeId: string;
      contractType: string;
      startDate: string;
      endDate: string | null;
      signedOn: string | null;
      archiveDocumentId: string | null;
    },
  ): Promise<void> {
    await executor.insert(employmentContract).values({
      id: contract.id,
      organizationId: contract.organizationId,
      episodeId: contract.episodeId,
      contractType: contract.contractType as typeof employmentContract.$inferInsert.contractType,
      startDate: contract.startDate,
      endDate: contract.endDate,
      signedOn: contract.signedOn,
      archiveDocumentId: contract.archiveDocumentId,
    });
  }

  async closeEpisode(
    executor: DbExecutor,
    episodeId: string,
    endDate: string,
    endReason: string,
  ): Promise<void> {
    await executor
      .update(employmentEpisode)
      .set({ endDate, endReason })
      .where(eq(employmentEpisode.id, episodeId));
  }

  async addTransition(
    executor: DbExecutor,
    transition: {
      id: string;
      organizationId: string;
      employeeId: string;
      fromStatus: EmploymentStatus | null;
      toStatus: EmploymentStatus;
      effectiveDate: string;
      recordedAt: Date;
      actorAccountId: string | null;
      reason: string;
      endReason: string | null;
    },
  ): Promise<void> {
    await executor.insert(employeeStatusTransition).values({
      id: transition.id,
      organizationId: transition.organizationId,
      employeeId: transition.employeeId,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      effectiveDate: transition.effectiveDate,
      recordedAt: transition.recordedAt,
      actorAccountId: transition.actorAccountId,
      reason: transition.reason,
      endReason: transition.endReason,
    });
  }

  /** Reads the highest episode number to allocate the next one inside a transaction. */
  async maxEpisodeNo(executor: DbExecutor, employeeId: string): Promise<number> {
    const rows = await executor
      .select({ episodeNo: employmentEpisode.episodeNo })
      .from(employmentEpisode)
      .where(eq(employmentEpisode.employeeId, employeeId));
    return rows.reduce((max, row) => Math.max(max, row.episodeNo), 0);
  }
}
