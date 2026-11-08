/**
 * Access Control Engine - AI Movie Factory (SSOT Level 1, 2, 3)
 * Implements the Unified Hybrid RBAC + ABAC Architecture:
 * 
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Level 1: Platform Level (Pure RBAC)                         │
 * │ • Role = 'admin'   --> Full Owner Console, Financial Audit, │
 * │                         Global Ledger, Credit Intervention  │
 * │ • Role = 'creator' --> Standard Studio Production Access   │
 * └──────────────────────────────┬──────────────────────────────┘
 *                                │
 * ┌──────────────────────────────▼──────────────────────────────┐
 * │ Level 2: Workspace & Studio Team (Workspace RBAC)           │
 * │ • Roles: owner, director, writer, reviewer                  │
 * └──────────────────────────────┬──────────────────────────────┘
 *                                │
 * ┌──────────────────────────────▼──────────────────────────────┐
 * │ Level 3: Quota, Financial & Render (Contextual ABAC)        │
 * │ • 4K Export       --> Attribute `subscription.tier = pro`   │
 * │ • AI Execution    --> Attribute `credit_balance >= cost`    │
 * │ • Project Access  --> Attribute `project.user_id = uid` OR  │
 * │                       `is_member(project.workspace_id)`     │
 * └─────────────────────────────────────────────────────────────┘
 */

import {
  SubscriptionTier,
  WorkspaceRole,
  OutputResolution,
  Project,
  Workspace
} from '../types/database';

// ============================================================================
// LEVEL 1: PLATFORM LEVEL (PURE RBAC)
// ============================================================================

export type PlatformRole = 'admin' | 'creator';

export const OWNER_SUPERADMIN_EMAIL = 'islamiahiis243@gmail.com';

export function isPlatformAdmin(userEmail?: string | null, role?: string | null): boolean {
  if (userEmail && userEmail.toLowerCase() === OWNER_SUPERADMIN_EMAIL) {
    return true;
  }
  return role === 'admin';
}

export function canAccessAdminConsole(userEmail?: string | null, role?: string | null): boolean {
  return isPlatformAdmin(userEmail, role);
}

export function canAuditPlatformLedger(userEmail?: string | null, role?: string | null): boolean {
  return isPlatformAdmin(userEmail, role);
}

export function canInterveneUserCredits(userEmail?: string | null, role?: string | null): boolean {
  return isPlatformAdmin(userEmail, role);
}

export function canRollbackPaymentOrder(userEmail?: string | null, role?: string | null): boolean {
  return isPlatformAdmin(userEmail, role);
}

// ============================================================================
// LEVEL 2: WORKSPACE & STUDIO TEAM (WORKSPACE RBAC)
// ============================================================================

export interface WorkspacePermissions {
  canManageWorkspaceSettings: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canEditScreenplayAndLore: boolean;
  canApproveProductionTasks: boolean;
  canExportStudioMedia: boolean;
  canViewWorkspace: boolean;
}

export function getWorkspaceRolePermissions(role: WorkspaceRole): WorkspacePermissions {
  switch (role) {
    case 'owner':
      return {
        canManageWorkspaceSettings: true,
        canInviteMembers: true,
        canRemoveMembers: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canEditScreenplayAndLore: true,
        canApproveProductionTasks: true,
        canExportStudioMedia: true,
        canViewWorkspace: true
      };

    case 'director':
      return {
        canManageWorkspaceSettings: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: false,
        canEditScreenplayAndLore: true,
        canApproveProductionTasks: true,
        canExportStudioMedia: true,
        canViewWorkspace: true
      };

    case 'writer':
      return {
        canManageWorkspaceSettings: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canEditScreenplayAndLore: true,
        canApproveProductionTasks: false,
        canExportStudioMedia: false,
        canViewWorkspace: true
      };

    case 'reviewer':
    default:
      return {
        canManageWorkspaceSettings: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canEditScreenplayAndLore: false,
        canApproveProductionTasks: false,
        canExportStudioMedia: false,
        canViewWorkspace: true
      };
  }
}

// ============================================================================
// LEVEL 3: QUOTA, FINANCIAL & RENDER (CONTEXTUAL ABAC)
// ============================================================================

export interface AbacContext {
  userId: string;
  userEmail?: string | null;
  platformRole?: PlatformRole | string;
  subscriptionTier: SubscriptionTier;
  creditBalance: number;
}

/**
 * ABAC Rule 1: 4K Ultra HD & ProRes Master Export
 * Allowed only if subscription tier is Pro Studio, Production House, or platform Admin.
 */
export function canExportResolution(
  context: AbacContext,
  targetResolution: OutputResolution
): { allowed: boolean; reason?: string } {
  if (isPlatformAdmin(context.userEmail, context.platformRole)) {
    return { allowed: true };
  }

  if (targetResolution === '4K') {
    const isProTier =
      context.subscriptionTier === 'pro_studio' ||
      context.subscriptionTier === 'production_house';
    if (!isProTier) {
      return {
        allowed: false,
        reason:
          'Resolusi 4K Ultra HD & ProRes memerlukan paket langganan Pro Studio atau Production House.'
      };
    }
  }

  return { allowed: true };
}

/**
 * ABAC Rule 2: Dynamic AI Job Execution & Credit Quota
 * Evaluates whether current credit balance satisfies the required computation budget.
 */
export function canExecuteAiJob(
  context: AbacContext,
  costInCredits: number
): { allowed: boolean; remainingCredits: number; reason?: string } {
  if (isPlatformAdmin(context.userEmail, context.platformRole)) {
    return { allowed: true, remainingCredits: context.creditBalance };
  }

  if (context.creditBalance < costInCredits) {
    return {
      allowed: false,
      remainingCredits: context.creditBalance,
      reason: `Saldo kredit tidak mencukupi (Memerlukan ${costInCredits} kredit, saldo tersedia: ${context.creditBalance} kredit). Silakan top-up atau upgrade paket studio.`
    };
  }

  return {
    allowed: true,
    remainingCredits: context.creditBalance - costInCredits
  };
}

/**
 * ABAC Rule 3: Workspace Seat Limit Attribute
 * Evaluates whether adding a member will violate the tier-governed seat constraint.
 */
export function canAddWorkspaceMember(workspace: Workspace): {
  allowed: boolean;
  maxSeats: number;
  currentSeats: number;
  reason?: string;
} {
  const maxSeats = Number(workspace.seat_limit || workspace.max_seats || 1);
  const currentSeats = Number(workspace.active_seats_count || 1);

  if (currentSeats >= maxSeats) {
    return {
      allowed: false,
      maxSeats,
      currentSeats,
      reason: `Batas kursi tim studio telah tercapai (${currentSeats}/${maxSeats}). Upgrade paket langganan studio Anda untuk menambah lebih banyak anggota kolaborator.`
    };
  }

  return { allowed: true, maxSeats, currentSeats };
}

/**
 * ABAC Rule 4: Contextual Project Access
 * Verifies whether the requesting user owns the project or is an active member of its associated workspace.
 */
export function canAccessProject(
  userId: string,
  project: Project,
  userWorkspaceIds: string[] = []
): boolean {
  if (project.user_id === userId) return true;
  if (project.workspace_id && userWorkspaceIds.includes(project.workspace_id)) {
    return true;
  }
  return false;
}
