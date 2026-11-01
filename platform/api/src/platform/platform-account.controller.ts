import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  CreateAccountRequestSchema,
  RoleAssignmentRequestSchema,
} from '@h-os/contracts';
import type {
  AccountListResponse,
  CreateAccountRequest,
  RoleAssignmentRequest,
} from '@h-os/contracts';
import { AccountManagementService, CurrentActor, ZodValidationPipe } from '@h-os/kernel';
import type { Actor } from '@h-os/kernel';
import { z } from 'zod';

const RoleCodeParamSchema = z.string().min(2).max(64);

/**
 * The HTTP boundary of the account administration use cases (DEC-0003, SEC-002). Every route is
 * authenticated by the global guard and checked again inside the service; the server response
 * never includes credential material (SEC-005, LOG-003).
 */
@Controller('api/v1/platform/accounts')
export class PlatformAccountController {
  constructor(
    @Inject(AccountManagementService)
    private readonly accounts: AccountManagementService,
  ) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<AccountListResponse> {
    return { items: [...(await this.accounts.list(actor))] };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateAccountRequestSchema)) input: CreateAccountRequest,
  ): Promise<{ accountId: string }> {
    const accountId = await this.accounts.create(actor, input);
    return { accountId };
  }

  @Post(':accountId/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assignRole(
    @CurrentActor() actor: Actor,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(RoleAssignmentRequestSchema)) input: RoleAssignmentRequest,
  ): Promise<void> {
    await this.accounts.assignRole(actor, accountId, input.roleCode);
  }

  @Delete(':accountId/roles/:roleCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeRole(
    @CurrentActor() actor: Actor,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('roleCode', new ZodValidationPipe(RoleCodeParamSchema)) roleCode: string,
  ): Promise<void> {
    await this.accounts.revokeRole(actor, accountId, roleCode);
  }

  @Post(':accountId/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disable(
    @CurrentActor() actor: Actor,
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ): Promise<void> {
    await this.accounts.disable(actor, accountId);
  }
}
