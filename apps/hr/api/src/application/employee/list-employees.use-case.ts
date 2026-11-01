import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeListQuery, EmployeeSearchResult } from '@h-os/contracts';
import { Permission, decodeCursor, encodeCursor } from '@h-os/contracts';
import type { Actor } from '@h-os/kernel';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { EMPLOYEE_REPOSITORY } from '../ports.js';
import type { EmployeeRepository } from '../ports.js';

/**
 * Permission-aware employee list. The data scope is translated into a SQL predicate by the
 * repository, never applied in memory (SEC-003), and every page is bounded (PERF-003).
 */
@Injectable()
export class ListEmployeesUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, query: EmployeeListQuery): Promise<EmployeeSearchResult> {
    const scope = await this.scope.dataScope(actor, Permission.HR_EMPLOYEE_READ);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const page = await this.employees.search(
      actor.organizationId,
      {
        q: query.q,
        status: query.status,
        branchId: query.branchId,
        unitId: query.orgUnitId,
        jobTitleId: query.jobTitleId,
        workLocationId: query.workLocationId,
        managerEmployeeId: query.managerEmployeeId,
      },
      scope,
      query.limit,
      cursor,
    );

    return {
      items: page.rows.map((row) => ({
        id: row.id,
        employeeNumber: row.employeeNumber,
        displayName: { en: row.displayNameEn, ar: row.displayNameAr },
        status: row.status,
        workEmail: row.workEmail,
      })),
      nextCursor: page.nextCursor
        ? encodeCursor(page.nextCursor.key, page.nextCursor.id)
        : null,
    };
  }
}
