/**
 * WILLShop OS — Server-Side Organization Context Resolver
 * Application Layer.
 * 
 * CRITICAL RULE: Context is strictly resolved server-side based on authenticated session.
 * The client CANNOT send or override the organization_id arbitrarily.
 */

import { IOrganizationRepository, UserOrgRoleContext } from '../../domain/interfaces/IRepositories';
import { Organization } from '../../domain/entities/Organization';
import { UserRole, ROLE_PERMISSIONS, ActionPermission } from '../../domain/types/rbac';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../domain/errors/AppErrors';

export interface ValidatedOrganizationContext {
  userId: string;
  organization: Organization;
  role: UserRole;
  permissions: ActionPermission[];
}

export class OrganizationContextService {
  constructor(private readonly orgRepo: IOrganizationRepository) {}

  /**
   * Resolves the current organization context safely on the server side.
   */
  async getOrganizationContext(
    authenticatedUserId: string | null,
    targetOrgSlugOrId?: string
  ): Promise<ValidatedOrganizationContext> {
    if (!authenticatedUserId) {
      throw new UnauthorizedError('User authentication required to resolve organization context');
    }

    const userRoles: UserOrgRoleContext[] = await this.orgRepo.getUserRoles(authenticatedUserId);

    if (!userRoles || userRoles.length === 0) {
      throw new ForbiddenError('User is not assigned to any active organization');
    }

    let selectedRoleCtx: UserOrgRoleContext | undefined;

    if (targetOrgSlugOrId) {
      // Find matching org by id or slug if user has access
      selectedRoleCtx = userRoles.find(
        (r) => r.organizationId === targetOrgSlugOrId
      );

      if (!selectedRoleCtx) {
        // Check if slug match
        const orgBySlug = await this.orgRepo.findBySlug(targetOrgSlugOrId);
        if (orgBySlug) {
          selectedRoleCtx = userRoles.find((r) => r.organizationId === orgBySlug.id);
        }
      }

      if (!selectedRoleCtx) {
        throw new ForbiddenError(`Access denied to organization '${targetOrgSlugOrId}'`);
      }
    } else {
      // Default to first active assigned organization (e.g. WillShop)
      selectedRoleCtx = userRoles[0];
    }

    const organization = await this.orgRepo.findById(selectedRoleCtx.organizationId);
    if (!organization) {
      throw new NotFoundError(`Organization '${selectedRoleCtx.organizationId}' not found`);
    }

    const role = selectedRoleCtx.role;
    const permissions = ROLE_PERMISSIONS[role] || [];

    return {
      userId: authenticatedUserId,
      organization,
      role,
      permissions,
    };
  }

  /**
   * Enforces server-side permission check.
   */
  verifyPermission(ctx: ValidatedOrganizationContext, action: ActionPermission): void {
    if (!ctx.permissions.includes(action)) {
      throw new ForbiddenError(
        `Role '${ctx.role}' does not have permission to execute action '${action}' in organization '${ctx.organization.name}'`
      );
    }
  }
}

// AUDIT FIX: Module-level context store.
// - In tests/dev: use setMockContext() to set the context before each test.
// - In production: getOrganizationContext() MUST be called with a real userId via the API route layer.
//   If this function is called without setMockContext() having been called first in production,
//   it will throw to prevent silent mock context leakage.
let mockContextState: { userId: string; organizationId: string; role: UserRole } | null = null;

// Sentinel to detect if we're running in a test environment
const IS_TEST_ENV = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

// Default context only for test environments — never for production
if (IS_TEST_ENV) {
  mockContextState = {
    userId: 'user-ceo-wilty',
    organizationId: 'org-willshop-001',
    role: 'OWNER',
  };
}

export function setMockContext(ctx: { userId: string; organizationId: string; role: UserRole }): void {
  mockContextState = ctx;
}

export function setMockOrgContext(ctx: { userId: string; organizationId: string; role: UserRole }): void {
  mockContextState = ctx;
}

/**
 * AUDIT FIX: getOrganizationContext() now throws in production if no mock context was set.
 * Application services should pass the authenticated userId from the API route layer
 * via setMockContext() (in tests) or via OrganizationContextService.getOrganizationContext() (in prod).
 */
export async function getOrganizationContext(): Promise<{
  userId: string;
  organizationId: string;
  role: UserRole;
  permissions: ActionPermission[];
}> {
  if (!mockContextState) {
    // AUDIT FIX: In production, if no context was set, fail loudly instead of using a hardcoded mock
    throw new ForbiddenError(
      '[OrganizationContextService] No organization context has been set. ' +
      'API routes must call setMockContext() with the authenticated user context before invoking application services.'
    );
  }

  const role = mockContextState.role || 'OWNER';
  const permissions = ROLE_PERMISSIONS[role] || [];
  return {
    userId: mockContextState.userId,
    organizationId: mockContextState.organizationId,
    role,
    permissions,
  };
}

export function verifyPermission(role: UserRole, action: ActionPermission): void {
  const permissions = ROLE_PERMISSIONS[role] || [];
  if (!permissions.includes(action)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${action}'`);
  }
}

