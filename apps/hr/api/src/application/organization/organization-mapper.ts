import type {
  Branch,
  JobGrade,
  JobTitle,
  OrganizationOverview,
  OrgUnit,
  WorkLocation,
  WorkSchedule,
} from '@h-os/contracts';
import type {
  BranchRow,
  JobGradeRow,
  JobTitleRow,
  OrganizationOverviewData,
  OrgUnitRow,
  WorkLocationRow,
  WorkScheduleRow,
} from '../ports.js';

function archivedAt(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export function toBranchView(row: BranchRow): Branch {
  return {
    id: row.id,
    code: row.code,
    name: { en: row.nameEn, ar: row.nameAr },
    timeZone: row.timeZone,
    archivedAt: archivedAt(row.archivedAt),
  };
}

export function toWorkLocationView(row: WorkLocationRow): WorkLocation {
  return {
    id: row.id,
    branchId: row.branchId,
    code: row.code,
    name: { en: row.nameEn, ar: row.nameAr },
    addressLine: row.addressLine,
    timeZone: row.timeZone,
    archivedAt: archivedAt(row.archivedAt),
  };
}

export function toOrgUnitView(row: OrgUnitRow): OrgUnit {
  return {
    id: row.id,
    branchId: row.branchId,
    parentId: row.parentId,
    kind: row.kind as OrgUnit['kind'],
    code: row.code,
    name: { en: row.nameEn, ar: row.nameAr },
    path: row.path,
    archivedAt: archivedAt(row.archivedAt),
  };
}

export function toJobTitleView(row: JobTitleRow): JobTitle {
  return {
    id: row.id,
    code: row.code,
    name: { en: row.nameEn, ar: row.nameAr },
    archivedAt: archivedAt(row.archivedAt),
  };
}

export function toJobGradeView(row: JobGradeRow): JobGrade {
  return {
    id: row.id,
    code: row.code,
    name: { en: row.nameEn, ar: row.nameAr },
    rank: row.rank,
    archivedAt: archivedAt(row.archivedAt),
  };
}

export function toWorkScheduleView(row: WorkScheduleRow): WorkSchedule {
  return {
    id: row.id,
    code: row.code,
    name: { en: row.nameEn, ar: row.nameAr },
    timeZone: row.timeZone,
    days: [...row.days],
    archivedAt: archivedAt(row.archivedAt),
  };
}

export function toOrganizationOverview(data: OrganizationOverviewData): OrganizationOverview {
  return {
    branches: data.branches.map(toBranchView),
    locations: data.locations.map(toWorkLocationView),
    orgUnits: data.orgUnits.map(toOrgUnitView),
    jobTitles: data.jobTitles.map(toJobTitleView),
    jobGrades: data.jobGrades.map(toJobGradeView),
    workSchedules: data.workSchedules.map(toWorkScheduleView),
  };
}
