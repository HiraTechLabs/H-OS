import { Inject } from '@nestjs/common';
import { and, asc, eq, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DATABASE } from '@h-os/kernel';
import type { DbExecutor, Database } from '@h-os/kernel';
import { formatEmployeeNumber } from '../domain/employee-number.js';
import type { EmploymentStatus } from '../domain/employment-status.js';
import type {
  AccountLinkRecord,
  ContactRecord,
  ContractRecord,
  DataScope,
  DocumentRecord,
  EmergencyContactRecord,
  EmployeeAggregate,
  EmployeeRepository,
  EmployeeSearchRow,
  EpisodeRecord,
  ManagerRecord,
  NewEmployeeData,
  PersonRecord,
  SearchFilter,
  SearchPage,
} from '../application/ports.js';
import {
  branch,
  employee,
  employeeAccountLink,
  employeeContact,
  employeeDocumentRef,
  employeeManagerAssignment,
  employeeNumberSequence,
  employeeOrgAssignment,
  employeePerson,
  employmentContract,
  employmentEpisode,
  emergencyContact,
  jobTitle,
  orgUnit,
  workLocation,
} from './schema.js';

const managerEmployee = alias(employee, 'manager_employee');
const managerPerson = alias(employeePerson, 'manager_person');

function toPerson(row: typeof employeePerson.$inferSelect): PersonRecord {
  return {
    givenNameEn: row.givenNameEn,
    familyNameEn: row.familyNameEn,
    givenNameAr: row.givenNameAr,
    familyNameAr: row.familyNameAr,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    nationality: row.nationality,
    nationalIdCiphertext: row.nationalIdCiphertext,
    nationalIdLast4: row.nationalIdLast4,
    nationalIdHash: row.nationalIdHash,
    passportCiphertext: row.passportCiphertext,
    passportLast4: row.passportLast4,
  };
}

export class DrizzleEmployeeRepository implements EmployeeRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async nextEmployeeNumber(executor: DbExecutor, organizationId: string): Promise<string> {
    const [row] = await executor
      .insert(employeeNumberSequence)
      .values({ organizationId, lastValue: 1 })
      .onConflictDoUpdate({
        target: employeeNumberSequence.organizationId,
        set: { lastValue: sql`${employeeNumberSequence.lastValue} + 1` },
      })
      .returning({ lastValue: employeeNumberSequence.lastValue });
    if (!row) {
      throw new Error('Could not allocate an employee number.');
    }
    return formatEmployeeNumber(row.lastValue);
  }

  async insert(executor: DbExecutor, data: NewEmployeeData): Promise<void> {
    const now = new Date();
    await executor.insert(employee).values({
      id: data.id,
      organizationId: data.organizationId,
      employeeNumber: data.employeeNumber,
      status: data.status,
      workEmail: data.workEmail,
      createdAt: now,
      updatedAt: now,
    });
    await executor.insert(employeePerson).values({
      employeeId: data.id,
      givenNameEn: data.person.givenNameEn,
      familyNameEn: data.person.familyNameEn,
      givenNameAr: data.person.givenNameAr,
      familyNameAr: data.person.familyNameAr,
      dateOfBirth: data.person.dateOfBirth,
      gender: data.person.gender,
      nationality: data.person.nationality,
      nationalIdCiphertext: data.person.nationalIdCiphertext,
      nationalIdLast4: data.person.nationalIdLast4,
      nationalIdHash: data.person.nationalIdHash,
      passportCiphertext: data.person.passportCiphertext,
      passportLast4: data.person.passportLast4,
      updatedAt: now,
    });
    await executor.insert(employeeContact).values({
      employeeId: data.id,
      personalEmail: data.contact.personalEmail,
      phone: data.contact.phone,
      city: data.contact.city,
      updatedAt: now,
    });
  }

  async findById(employeeId: string): Promise<EmployeeAggregate | null> {
    const [core] = await this.db
      .select()
      .from(employee)
      .where(eq(employee.id, employeeId))
      .limit(1);
    if (!core) return null;

    const [personRow] = await this.db
      .select()
      .from(employeePerson)
      .where(eq(employeePerson.employeeId, employeeId))
      .limit(1);
    const [contactRow] = await this.db
      .select()
      .from(employeeContact)
      .where(eq(employeeContact.employeeId, employeeId))
      .limit(1);

    const [emergencyRows, episodeRows, contractRows, assignmentRows, managerRows, documentRows, linkRows] =
      await Promise.all([
        this.db
          .select()
          .from(emergencyContact)
          .where(eq(emergencyContact.employeeId, employeeId))
          .orderBy(asc(emergencyContact.priority)),
        this.db
          .select()
          .from(employmentEpisode)
          .where(eq(employmentEpisode.employeeId, employeeId))
          .orderBy(asc(employmentEpisode.episodeNo)),
        this.db
          .select({
            id: employmentContract.id,
            episodeId: employmentContract.episodeId,
            contractType: employmentContract.contractType,
            startDate: employmentContract.startDate,
            endDate: employmentContract.endDate,
            signedOn: employmentContract.signedOn,
            archiveDocumentId: employmentContract.archiveDocumentId,
          })
          .from(employmentContract)
          .innerJoin(employmentEpisode, eq(employmentEpisode.id, employmentContract.episodeId))
          .where(eq(employmentEpisode.employeeId, employeeId))
          .orderBy(asc(employmentContract.startDate)),
        this.db
          .select()
          .from(employeeOrgAssignment)
          .where(eq(employeeOrgAssignment.employeeId, employeeId))
          .orderBy(asc(employeeOrgAssignment.validFrom)),
        this.db
          .select()
          .from(employeeManagerAssignment)
          .where(eq(employeeManagerAssignment.employeeId, employeeId))
          .orderBy(asc(employeeManagerAssignment.validFrom)),
        this.db
          .select()
          .from(employeeDocumentRef)
          .where(eq(employeeDocumentRef.employeeId, employeeId))
          .orderBy(asc(employeeDocumentRef.documentType)),
        this.db
          .select()
          .from(employeeAccountLink)
          .where(
            and(eq(employeeAccountLink.employeeId, employeeId), isNull(employeeAccountLink.unlinkedAt)),
          )
          .limit(1),
      ]);

    const emergencyContacts: EmergencyContactRecord[] = emergencyRows.map((row) => ({
      id: row.id,
      name: row.name,
      relationship: row.relationship,
      phone: row.phone,
      priority: row.priority,
      verifiedAt: row.verifiedAt,
    }));

    const episodes: EpisodeRecord[] = episodeRows.map((row) => ({
      id: row.id,
      episodeNo: row.episodeNo,
      employmentType: row.employmentType,
      startDate: row.startDate,
      endDate: row.endDate,
      probationEndDate: row.probationEndDate,
      endReason: row.endReason,
    }));

    const contracts: ContractRecord[] = contractRows.map((row) => ({
      id: row.id,
      episodeId: row.episodeId,
      contractType: row.contractType,
      startDate: row.startDate,
      endDate: row.endDate,
      signedOn: row.signedOn,
      archiveDocumentId: row.archiveDocumentId,
    }));

    const assignments = assignmentRows.map((row) => ({
      id: row.id,
      branchId: row.branchId,
      workLocationId: row.workLocationId,
      orgUnitId: row.orgUnitId,
      jobTitleId: row.jobTitleId,
      jobGradeId: row.jobGradeId,
      workArrangement: row.workArrangement,
      workScheduleId: row.workScheduleId,
      costCenterRef: row.costCenterRef,
      validFrom: row.validFrom,
      validTo: row.validTo,
      reason: row.reason,
    }));

    const managers: ManagerRecord[] = managerRows.map((row) => ({
      id: row.id,
      managerEmployeeId: row.managerEmployeeId,
      validFrom: row.validFrom,
      validTo: row.validTo,
      reason: row.reason,
    }));

    const documents: DocumentRecord[] = documentRows.map((row) => ({
      id: row.id,
      archiveDocumentId: row.archiveDocumentId,
      documentType: row.documentType,
      classification: row.classification,
      issuedOn: row.issuedOn,
      expiresOn: row.expiresOn,
    }));

    const linkRow = linkRows[0];
    const accountLink: AccountLinkRecord | null = linkRow
      ? { accountId: linkRow.accountId, linkedAt: linkRow.linkedAt }
      : null;

    return {
      core: {
        id: core.id,
        organizationId: core.organizationId,
        employeeNumber: core.employeeNumber,
        status: core.status,
        workEmail: core.workEmail,
        archivedAt: core.archivedAt,
      },
      person: personRow ? toPerson(personRow) : emptyPerson(),
      contact: {
        personalEmail: contactRow?.personalEmail ?? null,
        phone: contactRow?.phone ?? null,
        city: contactRow?.city ?? null,
      },
      emergencyContacts,
      episodes,
      contracts,
      assignments,
      managers,
      documents,
      accountLink,
    };
  }

  async findIdByAccount(organizationId: string, accountId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ employeeId: employeeAccountLink.employeeId })
      .from(employeeAccountLink)
      .where(
        and(
          eq(employeeAccountLink.organizationId, organizationId),
          eq(employeeAccountLink.accountId, accountId),
          isNull(employeeAccountLink.unlinkedAt),
        ),
      )
      .limit(1);
    return row?.employeeId ?? null;
  }

  async nationalIdHashExists(organizationId: string, hash: string): Promise<boolean> {
    const [row] = await this.db
      .select({ employeeId: employeePerson.employeeId })
      .from(employeePerson)
      .innerJoin(employee, eq(employee.id, employeePerson.employeeId))
      .where(
        and(eq(employee.organizationId, organizationId), eq(employeePerson.nationalIdHash, hash)),
      )
      .limit(1);
    return row !== undefined;
  }

  async workEmailExists(organizationId: string, email: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: employee.id })
      .from(employee)
      .where(and(eq(employee.organizationId, organizationId), eq(employee.workEmail, email)))
      .limit(1);
    return row !== undefined;
  }

  async employeeNumberExists(organizationId: string, employeeNumber: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: employee.id })
      .from(employee)
      .where(
        and(eq(employee.organizationId, organizationId), eq(employee.employeeNumber, employeeNumber)),
      )
      .limit(1);
    return row !== undefined;
  }

  async search(
    organizationId: string,
    filter: SearchFilter,
    scope: DataScope,
    limit: number,
    cursor: { key: string; id: string } | null,
  ): Promise<SearchPage> {
    const conditions = [eq(employee.organizationId, organizationId), isNull(employee.archivedAt)];

    const scopeCondition = this.scopeCondition(scope);
    if (scopeCondition) conditions.push(scopeCondition);

    if (filter.status && filter.status.length > 0) {
      conditions.push(inArray(employee.status, filter.status as EmploymentStatus[]));
    }
    if (filter.branchId) conditions.push(eq(employeeOrgAssignment.branchId, filter.branchId));
    if (filter.unitId) conditions.push(eq(employeeOrgAssignment.orgUnitId, filter.unitId));
    if (filter.jobTitleId) conditions.push(eq(employeeOrgAssignment.jobTitleId, filter.jobTitleId));
    if (filter.workLocationId) {
      conditions.push(eq(employeeOrgAssignment.workLocationId, filter.workLocationId));
    }
    if (filter.managerEmployeeId) {
      conditions.push(eq(employeeManagerAssignment.managerEmployeeId, filter.managerEmployeeId));
    }
    if (filter.q && filter.q.trim().length > 0) {
      const pattern = `%${filter.q.trim().replace(/[%_]/g, (match) => `\\${match}`)}%`;
      const textMatch = or(
        ilike(employee.employeeNumber, pattern),
        ilike(employee.workEmail, pattern),
        ilike(employeePerson.givenNameEn, pattern),
        ilike(employeePerson.familyNameEn, pattern),
        ilike(employeePerson.givenNameAr, pattern),
        ilike(employeePerson.familyNameAr, pattern),
      );
      if (textMatch) conditions.push(textMatch);
    }
    if (cursor) {
      const after = or(
        gt(employee.employeeNumber, cursor.key),
        and(eq(employee.employeeNumber, cursor.key), gt(employee.id, cursor.id)),
      );
      if (after) conditions.push(after);
    }

    const rows = await this.db
      .select({
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        givenNameEn: employeePerson.givenNameEn,
        familyNameEn: employeePerson.familyNameEn,
        givenNameAr: employeePerson.givenNameAr,
        familyNameAr: employeePerson.familyNameAr,
        status: employee.status,
        workEmail: employee.workEmail,
        branchNameEn: branch.nameEn,
        branchNameAr: branch.nameAr,
        unitNameEn: orgUnit.nameEn,
        unitNameAr: orgUnit.nameAr,
        jobTitleNameEn: jobTitle.nameEn,
        jobTitleNameAr: jobTitle.nameAr,
        locationNameEn: workLocation.nameEn,
        locationNameAr: workLocation.nameAr,
        managerGivenEn: managerPerson.givenNameEn,
        managerFamilyEn: managerPerson.familyNameEn,
        managerGivenAr: managerPerson.givenNameAr,
        managerFamilyAr: managerPerson.familyNameAr,
      })
      .from(employee)
      .innerJoin(employeePerson, eq(employeePerson.employeeId, employee.id))
      .leftJoin(
        employeeOrgAssignment,
        and(eq(employeeOrgAssignment.employeeId, employee.id), isNull(employeeOrgAssignment.validTo)),
      )
      .leftJoin(orgUnit, eq(orgUnit.id, employeeOrgAssignment.orgUnitId))
      .leftJoin(branch, eq(branch.id, employeeOrgAssignment.branchId))
      .leftJoin(workLocation, eq(workLocation.id, employeeOrgAssignment.workLocationId))
      .leftJoin(jobTitle, eq(jobTitle.id, employeeOrgAssignment.jobTitleId))
      .leftJoin(
        employeeManagerAssignment,
        and(eq(employeeManagerAssignment.employeeId, employee.id), isNull(employeeManagerAssignment.validTo)),
      )
      .leftJoin(managerEmployee, eq(managerEmployee.id, employeeManagerAssignment.managerEmployeeId))
      .leftJoin(managerPerson, eq(managerPerson.employeeId, managerEmployee.id))
      .where(and(...conditions))
      .orderBy(asc(employee.employeeNumber), asc(employee.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: EmployeeSearchRow[] = page.map((row) => ({
      id: row.id,
      employeeNumber: row.employeeNumber,
      displayNameEn: `${row.givenNameEn} ${row.familyNameEn}`.trim(),
      displayNameAr: `${row.givenNameAr} ${row.familyNameAr}`.trim(),
      status: row.status,
      workEmail: row.workEmail,
      branchNameEn: row.branchNameEn,
      branchNameAr: row.branchNameAr,
      unitNameEn: row.unitNameEn,
      unitNameAr: row.unitNameAr,
      jobTitleNameEn: row.jobTitleNameEn,
      jobTitleNameAr: row.jobTitleNameAr,
      locationNameEn: row.locationNameEn,
      locationNameAr: row.locationNameAr,
      managerNameEn:
        row.managerGivenEn && row.managerFamilyEn
          ? `${row.managerGivenEn} ${row.managerFamilyEn}`.trim()
          : null,
      managerNameAr:
        row.managerGivenAr && row.managerFamilyAr
          ? `${row.managerGivenAr} ${row.managerFamilyAr}`.trim()
          : null,
      sortKey: row.employeeNumber,
    }));

    const last = page[page.length - 1];
    return {
      rows: items,
      nextCursor: hasMore && last ? { key: last.employeeNumber, id: last.id } : null,
    };
  }

  /**
   * Data scope is applied in the query, never by filtering a full result set in memory
   * (SEC-003). `own` matches the actor's employee row; `unit` the actor's exact unit; `subtree`
   * the `ltree` descendant operator.
   */
  private scopeCondition(scope: DataScope) {
    if (scope.level === 'all') return undefined;
    if (scope.level === 'own') {
      if (!scope.actorEmployeeId) return sql`false`;
      return eq(employee.id, scope.actorEmployeeId);
    }
    if (!scope.actorOrgUnitPath) return sql`false`;
    if (scope.level === 'unit') return eq(orgUnit.path, scope.actorOrgUnitPath);
    return sql`${orgUnit.path} <@ ${scope.actorOrgUnitPath}::ltree`;
  }

  async updateCore(
    executor: DbExecutor,
    employeeId: string,
    values: { workEmail: string; status: EmploymentStatus; updatedAt: Date },
  ): Promise<void> {
    await executor
      .update(employee)
      .set({ workEmail: values.workEmail, status: values.status, updatedAt: values.updatedAt })
      .where(eq(employee.id, employeeId));
  }

  async updatePerson(executor: DbExecutor, employeeId: string, person: PersonRecord): Promise<void> {
    await executor
      .update(employeePerson)
      .set({
        givenNameEn: person.givenNameEn,
        familyNameEn: person.familyNameEn,
        givenNameAr: person.givenNameAr,
        familyNameAr: person.familyNameAr,
        dateOfBirth: person.dateOfBirth,
        gender: person.gender,
        nationality: person.nationality,
        nationalIdCiphertext: person.nationalIdCiphertext,
        nationalIdLast4: person.nationalIdLast4,
        nationalIdHash: person.nationalIdHash,
        passportCiphertext: person.passportCiphertext,
        passportLast4: person.passportLast4,
        updatedAt: new Date(),
      })
      .where(eq(employeePerson.employeeId, employeeId));
  }

  async updateContact(executor: DbExecutor, employeeId: string, contact: ContactRecord): Promise<void> {
    await executor
      .update(employeeContact)
      .set({
        personalEmail: contact.personalEmail,
        phone: contact.phone,
        city: contact.city,
        updatedAt: new Date(),
      })
      .where(eq(employeeContact.employeeId, employeeId));
  }

  async addEmergencyContact(
    executor: DbExecutor,
    employeeId: string,
    organizationId: string,
    contact: { id: string; name: string; relationship: string; phone: string; priority: number },
  ): Promise<void> {
    await executor.insert(emergencyContact).values({
      id: contact.id,
      organizationId,
      employeeId,
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      priority: contact.priority,
    });
  }

  async linkAccount(
    executor: DbExecutor,
    employeeId: string,
    organizationId: string,
    accountId: string,
    actorAccountId: string,
    at: Date,
  ): Promise<void> {
    await executor.insert(employeeAccountLink).values({
      employeeId,
      organizationId,
      accountId,
      linkedAt: at,
      linkedBy: actorAccountId,
    });
  }

  async unlinkAccount(executor: DbExecutor, employeeId: string, at: Date): Promise<void> {
    await executor
      .update(employeeAccountLink)
      .set({ unlinkedAt: at })
      .where(and(eq(employeeAccountLink.employeeId, employeeId), isNull(employeeAccountLink.unlinkedAt)));
  }

  async addDocument(
    executor: DbExecutor,
    employeeId: string,
    organizationId: string,
    document: {
      id: string;
      archiveDocumentId: string;
      documentType: string;
      classification: string;
      issuedOn: string | null;
      expiresOn: string | null;
    },
  ): Promise<void> {
    await executor.insert(employeeDocumentRef).values({
      id: document.id,
      organizationId,
      employeeId,
      archiveDocumentId: document.archiveDocumentId,
      documentType: document.documentType,
      classification: document.classification,
      issuedOn: document.issuedOn,
      expiresOn: document.expiresOn,
    });
  }
}

function emptyPerson(): PersonRecord {
  return {
    givenNameEn: '',
    familyNameEn: '',
    givenNameAr: '',
    familyNameAr: '',
    dateOfBirth: null,
    gender: 'undisclosed',
    nationality: null,
    nationalIdCiphertext: null,
    nationalIdLast4: null,
    nationalIdHash: null,
    passportCiphertext: null,
    passportLast4: null,
  };
}
