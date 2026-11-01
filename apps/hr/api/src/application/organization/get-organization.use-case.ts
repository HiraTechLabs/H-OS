import { Inject, Injectable } from '@nestjs/common';
import type { OrganizationOverview } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import { PermissionService } from '@h-os/kernel';
import type { Actor } from '@h-os/kernel';
import { ORGANIZATION_REPOSITORY } from '../ports.js';
import type { OrganizationRepository } from '../ports.js';
import { toOrganizationOverview } from './organization-mapper.js';

/**
 * Organization reference data used to populate employee forms and profiles. Reading structure is
 * a separate permission from managing it (SEC-002), so a self-service account can render labels
 * without being able to change the tree.
 */
@Injectable()
export class GetOrganizationUseCase {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organization: OrganizationRepository,
    @Inject(PermissionService) private readonly permissions: PermissionService,
  ) {}

  async execute(actor: Actor): Promise<OrganizationOverview> {
    this.permissions.require(actor, Permission.HR_ORGANIZATION_READ);
    const data = await this.organization.overview(actor.organizationId);
    return toOrganizationOverview(data);
  }
}
