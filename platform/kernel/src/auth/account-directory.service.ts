import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DbExecutor } from '../db/client.js';
import { DATABASE } from '../db/database.provider.js';
import { account } from '../db/schema.js';

export interface AccountSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: string;
}

/**
 * Public contract for other modules that need to reference a login account. They never read the
 * `platform.account` table directly (ARCH-002, CORE-003).
 */
@Injectable()
export class AccountDirectoryService {
  constructor(@Inject(DATABASE) private readonly db: DbExecutor) {}

  async findById(accountId: string): Promise<AccountSummary | null> {
    const [row] = await this.db
      .select({
        id: account.id,
        organizationId: account.organizationId,
        email: account.email,
        displayName: account.displayName,
        status: account.status,
      })
      .from(account)
      .where(eq(account.id, accountId))
      .limit(1);
    return row ?? null;
  }
}
