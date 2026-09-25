/**
 * WILLShop OS V2 — In-Memory Repositories for Phase 0 / Phase 1
 */

import {
  CustomerEngagement,
  WorkRoutine,
  RoutineStep,
  WorkflowStackState,
  InternalThread,
  InternalThreadParticipant,
  InternalMessage,
  UserNotification,
} from '../../domain/entities/V2FoundationsEntities';
import { assertNotCommercialOrg } from '../../config/testGuardrails';

export class InMemoryCustomerEngagementRepository {
  private engagements: CustomerEngagement[] = [];

  async create(engagement: Omit<CustomerEngagement, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomerEngagement> {
    assertNotCommercialOrg(engagement.organizationId, 'InMemoryCustomerEngagementRepository.create');
    const record: CustomerEngagement = {
      ...engagement,
      id: `eng-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.engagements.push(record);
    return record;
  }

  async getByOrg(orgId: string): Promise<CustomerEngagement[]> {
    return this.engagements.filter((e) => e.organizationId === orgId);
  }

  async updateStatus(id: string, orgId: string, status: CustomerEngagement['status'], completedBy?: string): Promise<CustomerEngagement | null> {
    const item = this.engagements.find((e) => e.id === id && e.organizationId === orgId);
    if (!item) return null;
    item.status = status;
    item.updatedAt = new Date();
    if (status === 'COMPLETED') {
      item.completedAt = new Date();
      if (completedBy) item.completedBy = completedBy;
    }
    return item;
  }
}

export class InMemoryWorkRoutineRepository {
  private routines: WorkRoutine[] = [];
  private steps: RoutineStep[] = [];
  private stacks: WorkflowStackState[] = [];

  async getActiveRoutine(userId: string, orgId: string, routineDate: string): Promise<{ routine: WorkRoutine; steps: RoutineStep[] } | null> {
    const routine = this.routines.find((r) => r.userId === userId && r.organizationId === orgId && r.routineDate === routineDate && r.status === 'IN_PROGRESS');
    if (!routine) return null;
    const steps = this.steps.filter((s) => s.routineId === routine.id).sort((a, b) => a.stepOrder - b.stepOrder);
    return { routine, steps };
  }

  async createRoutine(routine: Omit<WorkRoutine, 'id' | 'createdAt' | 'updatedAt'>, stepKeys: string[]): Promise<{ routine: WorkRoutine; steps: RoutineStep[] }> {
    assertNotCommercialOrg(routine.organizationId, 'InMemoryWorkRoutineRepository.createRoutine');
    const newRoutine: WorkRoutine = {
      ...routine,
      id: `rout-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.routines.push(newRoutine);

    const newSteps: RoutineStep[] = stepKeys.map((key, idx) => ({
      id: `step-${Date.now()}-${idx}`,
      routineId: newRoutine.id,
      organizationId: routine.organizationId,
      stepKey: key,
      stepOrder: idx + 1,
      status: idx === 0 ? 'IN_PROGRESS' : 'PENDING',
      plannedItemsCount: 0,
      completedItemsCount: 0,
      startedAt: idx === 0 ? new Date() : undefined,
      createdAt: new Date(),
    }));
    this.steps.push(...newSteps);

    return { routine: newRoutine, steps: newSteps };
  }

  async completeStep(routineId: string, stepKey: string): Promise<RoutineStep | null> {
    const step = this.steps.find((s) => s.routineId === routineId && s.stepKey === stepKey);
    if (!step) return null;
    step.status = 'COMPLETED';
    step.completedAt = new Date();

    const routine = this.routines.find((r) => r.id === routineId);
    if (routine) {
      routine.totalActionsCompleted += step.completedItemsCount || 1;
    }
    return step;
  }

  async finishRoutine(routineId: string): Promise<WorkRoutine | null> {
    const routine = this.routines.find((r) => r.id === routineId);
    if (!routine) return null;
    routine.status = 'COMPLETED';
    routine.completedAt = new Date();
    routine.updatedAt = new Date();
    return routine;
  }

  async pushInterruption(stack: Omit<WorkflowStackState, 'id' | 'createdAt'>): Promise<WorkflowStackState> {
    assertNotCommercialOrg(stack.organizationId, 'InMemoryWorkRoutineRepository.pushInterruption');
    const record: WorkflowStackState = {
      ...stack,
      id: `stack-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
    };
    this.stacks.push(record);
    return record;
  }

  async getActiveInterruption(userId: string, orgId: string): Promise<WorkflowStackState | null> {
    return this.stacks.find((s) => s.userId === userId && s.organizationId === orgId && s.isActive) || null;
  }

  async popInterruption(stackId: string): Promise<WorkflowStackState | null> {
    const item = this.stacks.find((s) => s.id === stackId);
    if (!item) return null;
    item.isActive = false;
    item.resumedAt = new Date();
    return item;
  }
}

export class InMemoryInternalMessagingRepository {
  private threads: InternalThread[] = [];
  private participants: InternalThreadParticipant[] = [];
  private messages: InternalMessage[] = [];

  async createThread(thread: Omit<InternalThread, 'id' | 'createdAt' | 'updatedAt' | 'isArchived' | 'lastMessageAt'>, participantIds: string[]): Promise<InternalThread> {
    assertNotCommercialOrg(thread.organizationId, 'InMemoryInternalMessagingRepository.createThread');
    const newThread: InternalThread = {
      ...thread,
      id: `th-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      isArchived: false,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.threads.push(newThread);

    for (const pId of participantIds) {
      this.participants.push({
        threadId: newThread.id,
        userId: pId,
        organizationId: thread.organizationId,
        joinedAt: new Date(),
        lastReadAt: new Date(),
      });
    }

    return newThread;
  }

  async sendMessage(msg: Omit<InternalMessage, 'id' | 'createdAt'>): Promise<InternalMessage> {
    assertNotCommercialOrg(msg.organizationId, 'InMemoryInternalMessagingRepository.sendMessage');
    const record: InternalMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
    };
    this.messages.push(record);

    const thread = this.threads.find((t) => t.id === msg.threadId);
    if (thread) {
      thread.lastMessageAt = new Date();
      thread.updatedAt = new Date();
    }
    return record;
  }

  async getThreadsForUser(userId: string, orgId: string): Promise<InternalThread[]> {
    const threadIds = this.participants.filter((p) => p.userId === userId && p.organizationId === orgId).map((p) => p.threadId);
    return this.threads.filter((t) => threadIds.includes(t.id) && t.organizationId === orgId && !t.isArchived);
  }

  async getMessages(threadId: string, orgId: string): Promise<InternalMessage[]> {
    return this.messages.filter((m) => m.threadId === threadId && m.organizationId === orgId);
  }
}

export class InMemoryUserNotificationRepository {
  private notifications: UserNotification[] = [];

  async create(notif: Omit<UserNotification, 'id' | 'createdAt'>): Promise<UserNotification> {
    assertNotCommercialOrg(notif.organizationId, 'InMemoryUserNotificationRepository.create');
    const record: UserNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
    };
    this.notifications.push(record);
    return record;
  }

  async getUnreadForUser(userId: string, orgId: string): Promise<UserNotification[]> {
    return this.notifications.filter((n) => n.recipientId === userId && n.organizationId === orgId && !n.readAt);
  }

  async markAsRead(id: string, userId: string, orgId: string): Promise<UserNotification | null> {
    const item = this.notifications.find((n) => n.id === id && n.recipientId === userId && n.organizationId === orgId);
    if (!item) return null;
    item.readAt = new Date();
    return item;
  }
}
