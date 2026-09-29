/**
 * WILLShop OS — Supabase Production Repositories
 * Infrastructure Layer.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  IOrganizationRepository,
  IAuditRepository,
  IEventRepository,
  IIdempotencyRepository,
  UserOrgRoleContext,
} from '../../domain/interfaces/IRepositories';
import { Organization } from '../../domain/entities/Organization';
import { AuditLog } from '../../domain/entities/AuditLog';
import { SystemEvent, IdempotencyRecord } from '../../domain/entities/SystemEvent';
import { UserRole } from '../../domain/types/rbac';

export class SupabaseOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: string): Promise<Organization | null> {
    const { data, error } = await this.client
      .from('organizations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return this.mapToOrganization(data);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const { data, error } = await this.client
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return this.mapToOrganization(data);
  }

  async getUserRoles(userId: string): Promise<UserOrgRoleContext[]> {
    const { data, error } = await this.client
      .from('user_organization_roles')
      .select('user_id, organization_id, role, permissions')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data.map((r) => ({
      userId: r.user_id,
      organizationId: r.organization_id,
      role: r.role as UserRole,
      permissions: (r.permissions as string[]) || [],
    }));
  }

  private mapToOrganization(row: Record<string, unknown>): Organization {
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      country: row.country as string,
      currency: row.currency as string,
      timezone: row.timezone as string,
      settings: (row.settings as Record<string, unknown>) || {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      createdBy: row.created_by as string | undefined,
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
    };
  }
}

export class SupabaseAuditRepository implements IAuditRepository {
  constructor(private readonly client: SupabaseClient) {}

  async log(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    const { data, error } = await this.client
      .from('audit_log')
      .insert({
        organization_id: entry.organizationId,
        actor_id: entry.actorId,
        action: entry.action,
        target_entity: entry.targetEntity,
        target_id: entry.targetId,
        before_state: entry.beforeState,
        after_state: entry.afterState,
        reason: entry.reason,
        correlation_id: entry.correlationId,
        ai_agent: entry.aiAgent,
        ai_action: entry.aiAction,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to write audit log: ${error?.message}`);
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      actorId: data.actor_id,
      action: data.action,
      targetEntity: data.target_entity,
      targetId: data.target_id,
      beforeState: data.before_state,
      afterState: data.after_state,
      reason: data.reason,
      correlationId: data.correlation_id,
      aiAgent: data.ai_agent,
      aiAction: data.ai_action,
      createdAt: new Date(data.created_at),
    };
  }

  async getLogsByOrg(orgId: string, limit = 50): Promise<AuditLog[]> {
    const { data, error } = await this.client
      .from('audit_log')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map((d) => ({
      id: d.id,
      organizationId: d.organization_id,
      actorId: d.actor_id,
      action: d.action,
      targetEntity: d.target_entity,
      targetId: d.target_id,
      beforeState: d.before_state,
      afterState: d.after_state,
      reason: d.reason,
      correlationId: d.correlation_id,
      aiAgent: d.ai_agent,
      aiAction: d.ai_action,
      createdAt: new Date(d.created_at),
    }));
  }
}

export class SupabaseEventRepository implements IEventRepository {
  constructor(private readonly client: SupabaseClient) {}

  async recordEvent(entry: Omit<SystemEvent, 'id' | 'createdAt' | 'status'>): Promise<SystemEvent> {
    const { data, error } = await this.client
      .from('events')
      .insert({
        organization_id: entry.organizationId,
        event_type: entry.eventType,
        payload: entry.payload,
        actor_id: entry.actorId,
        correlation_id: entry.correlationId,
        status: 'PENDING',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to record system event: ${error?.message}`);
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      eventType: data.event_type,
      payload: data.payload,
      actorId: data.actor_id,
      correlationId: data.correlation_id,
      status: data.status,
      createdAt: new Date(data.created_at),
    };
  }
}

export class SupabaseIdempotencyRepository implements IIdempotencyRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findKey(key: string, orgId: string): Promise<IdempotencyRecord | null> {
    const { data, error } = await this.client
      .from('idempotency_keys')
      .select('*')
      .eq('key', key)
      .eq('organization_id', orgId)
      .single();

    if (error || !data) return null;

    return {
      key: data.key,
      organizationId: data.organization_id,
      requestHash: data.request_hash,
      responsePayload: data.response_payload,
      status: data.status,
      createdAt: new Date(data.created_at),
      expiresAt: new Date(data.expires_at),
    };
  }

  async createKey(key: string, orgId: string, requestHash: string): Promise<IdempotencyRecord> {
    const { data, error } = await this.client
      .from('idempotency_keys')
      .insert({
        key,
        organization_id: orgId,
        request_hash: requestHash,
        status: 'PROCESSING',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create idempotency key: ${error?.message}`);
    }

    return {
      key: data.key,
      organizationId: data.organization_id,
      requestHash: data.request_hash,
      responsePayload: data.response_payload,
      status: data.status,
      createdAt: new Date(data.created_at),
      expiresAt: new Date(data.expires_at),
    };
  }

  async completeKey(key: string, orgId: string, responsePayload: Record<string, unknown>): Promise<void> {
    await this.client
      .from('idempotency_keys')
      .update({
        status: 'COMPLETED',
        response_payload: responsePayload,
      })
      .eq('key', key)
      .eq('organization_id', orgId);
  }
}
