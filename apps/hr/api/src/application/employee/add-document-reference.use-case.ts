import { Inject, Injectable } from '@nestjs/common';
import type { AddDocumentReference } from '@h-os/contracts';
import { Permission, archiveDocumentRef } from '@h-os/contracts';
import {
  CLOCK,
  CONFIG,
  DATABASE,
  EntityLinkService,
  ID_GENERATOR,
  NotFoundError,
} from '@h-os/kernel';
import type { Actor, AppConfig, Clock, Database, IdGenerator } from '@h-os/kernel';
import { EmployeeChangeRecorder } from '../employee-change-recorder.js';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { EMPLOYEE_REPOSITORY } from '../ports.js';
import type { EmployeeRepository } from '../ports.js';

/**
 * Records a reference to a document owned by H-Archive and links the two entities. H-HR stores
 * no file bytes and does not claim the document exists: it stores the opaque ID plus HR's own
 * metadata (HHR-EMP-005, BIZ-011).
 */
@Injectable()
export class AddDocumentReferenceUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(EntityLinkService) private readonly links: EntityLinkService,
    @Inject(EmployeeChangeRecorder) private readonly recorder: EmployeeChangeRecorder,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, employeeId: string, input: AddDocumentReference): Promise<string> {
    await this.scope.assertCanAccess(actor, Permission.HR_EMPLOYEE_UPDATE, employeeId);
    const aggregate = await this.employees.findById(employeeId);
    if (!aggregate || aggregate.core.organizationId !== actor.organizationId) {
      throw new NotFoundError('The employee does not exist.');
    }

    const documentId = this.ids.uuid();
    const today = this.clock.today(this.config.organization.timeZone);

    await this.db.transaction(async (tx) => {
      await this.employees.addDocument(tx, employeeId, actor.organizationId, {
        id: documentId,
        archiveDocumentId: input.archiveDocumentId,
        documentType: input.documentType,
        classification: input.classification,
        issuedOn: input.issuedOn,
        expiresOn: input.expiresOn,
      });
      await this.links.link(
        tx,
        actor.organizationId,
        { app: 'hr', type: 'employee_document', id: documentId },
        [archiveDocumentRef(input.archiveDocumentId)],
      );
      await this.recorder.record(tx, actor, actor.organizationId, {
        action: 'hr.employee.document_linked',
        employeeId,
        effectiveOn: today,
        summaries: { en: 'Document reference added', ar: 'تمت إضافة مرجع مستند' },
        reason: null,
        after: {
          documentType: input.documentType,
          classification: input.classification,
        },
        relatedType: 'employee_document',
        relatedId: documentId,
      });
    });
    return documentId;
  }
}
