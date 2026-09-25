/**
 * WILLShop OS V2 — Internal Messaging & Notification Application Services
 */

import { InternalMessage, InternalMessageType, InternalThread, UserNotification, NotificationPriority } from '../../domain/entities/V2FoundationsEntities';
import { InMemoryInternalMessagingRepository, InMemoryUserNotificationRepository } from '../../infrastructure/repositories/InMemoryV2Repositories';

export class InternalMessagingService {
  constructor(private repo: InMemoryInternalMessagingRepository) {}

  async createThread(params: {
    organizationId: string;
    createdBy: string;
    participantIds: string[];
    title?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<InternalThread> {
    const participants = Array.from(new Set([params.createdBy, ...params.participantIds]));
    return this.repo.createThread(
      {
        organizationId: params.organizationId,
        createdBy: params.createdBy,
        title: params.title,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
      },
      participants
    );
  }

  async sendMessage(params: {
    organizationId: string;
    threadId: string;
    senderId: string;
    content: string;
    messageType?: InternalMessageType;
    metadata?: Record<string, any>;
  }): Promise<InternalMessage> {
    return this.repo.sendMessage({
      organizationId: params.organizationId,
      threadId: params.threadId,
      senderId: params.senderId,
      content: params.content,
      messageType: params.messageType || 'TEXT',
      metadata: params.metadata || {},
    });
  }

  async getUserThreads(userId: string, organizationId: string): Promise<InternalThread[]> {
    return this.repo.getThreadsForUser(userId, organizationId);
  }

  async getThreadMessages(threadId: string, organizationId: string): Promise<InternalMessage[]> {
    return this.repo.getMessages(threadId, organizationId);
  }
}

export class NotificationService {
  constructor(private repo: InMemoryUserNotificationRepository) {}

  async notify(params: {
    organizationId: string;
    recipientId: string;
    title: string;
    body: string;
    priority?: NotificationPriority;
    sourceType: string;
    sourceId?: string;
    deepLink?: string;
  }): Promise<UserNotification> {
    return this.repo.create({
      organizationId: params.organizationId,
      recipientId: params.recipientId,
      title: params.title,
      body: params.body,
      priority: params.priority || 'INFO',
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      deepLink: params.deepLink,
    });
  }

  async getUnread(userId: string, organizationId: string): Promise<UserNotification[]> {
    return this.repo.getUnreadForUser(userId, organizationId);
  }

  async markAsRead(id: string, userId: string, organizationId: string): Promise<UserNotification | null> {
    return this.repo.markAsRead(id, userId, organizationId);
  }
}
