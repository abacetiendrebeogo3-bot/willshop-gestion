/**
 * WILLShop OS V2 — Customer Engagement Application Service
 */

import { CustomerEngagement, EngagementPriority, EngagementSource, EngagementStatus } from '../../domain/entities/V2FoundationsEntities';
import { InMemoryCustomerEngagementRepository } from '../../infrastructure/repositories/InMemoryV2Repositories';

export class CustomerEngagementService {
  constructor(private repo: InMemoryCustomerEngagementRepository) {}

  async createEngagement(params: {
    organizationId: string;
    customerId: string;
    conversationId?: string;
    orderId?: string;
    assignedTo?: string;
    title: string;
    description?: string;
    dueAt: Date;
    priority?: EngagementPriority;
    source?: EngagementSource;
    evidence?: Record<string, any>;
  }): Promise<CustomerEngagement> {
    return this.repo.create({
      organizationId: params.organizationId,
      customerId: params.customerId,
      conversationId: params.conversationId,
      orderId: params.orderId,
      assignedTo: params.assignedTo,
      title: params.title,
      description: params.description,
      dueAt: params.dueAt,
      status: 'PENDING',
      priority: params.priority || 'IMPORTANT',
      source: params.source || 'COMMERCIAL_MANUAL',
      evidence: params.evidence || {},
    });
  }

  async getEngagementsForOrg(organizationId: string): Promise<CustomerEngagement[]> {
    return this.repo.getByOrg(organizationId);
  }

  async markAsCompleted(id: string, organizationId: string, completedBy?: string): Promise<CustomerEngagement | null> {
    return this.repo.updateStatus(id, organizationId, 'COMPLETED', completedBy);
  }

  async markAsPostponed(id: string, organizationId: string): Promise<CustomerEngagement | null> {
    return this.repo.updateStatus(id, organizationId, 'POSTPONED');
  }
}
