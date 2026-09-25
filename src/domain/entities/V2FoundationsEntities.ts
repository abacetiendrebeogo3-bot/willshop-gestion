/**
 * WILLShop OS V2 — Core Foundations Domain Entities
 */

export type EngagementStatus = 'PENDING' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED' | 'OVERDUE';
export type EngagementPriority = 'URGENT' | 'IMPORTANT' | 'NORMAL';
export type EngagementSource = 'WHATSAPP_AI_DETECTED' | 'COMMERCIAL_MANUAL' | 'SYSTEM_RULE';

export interface CustomerEngagement {
  id: string;
  organizationId: string;
  customerId: string;
  conversationId?: string;
  orderId?: string;
  assignedTo?: string;
  title: string;
  description?: string;
  dueAt: Date;
  status: EngagementStatus;
  priority: EngagementPriority;
  source: EngagementSource;
  evidence?: Record<string, any>;
  completedAt?: Date;
  completedBy?: string;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RoutineType = 'COMMERCIAL_MY_DAY' | 'CEO_MY_DIRECTION' | 'DRIVER_DAILY';
export type RoutineStatus = 'IN_PROGRESS' | 'COMPLETED' | 'INTERRUPTED' | 'ABANDONED';
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface WorkRoutine {
  id: string;
  organizationId: string;
  userId: string;
  routineType: RoutineType;
  routineDate: string; // YYYY-MM-DD
  startedAt: Date;
  completedAt?: Date;
  status: RoutineStatus;
  totalActionsPlanned: number;
  totalActionsCompleted: number;
  totalActionsPostponed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutineStep {
  id: string;
  routineId: string;
  organizationId: string;
  stepKey: string;
  stepOrder: number;
  status: StepStatus;
  plannedItemsCount: number;
  completedItemsCount: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface WorkflowStackState {
  id: string;
  organizationId: string;
  userId: string;
  routineId: string;
  pausedStep: string;
  stepContext?: Record<string, any>;
  interruptionReason: string;
  interruptionEntityType?: string;
  interruptionEntityId?: string;
  isActive: boolean;
  pausedAt: Date;
  resumedAt?: Date;
  createdAt: Date;
}

export interface InternalThread {
  id: string;
  organizationId: string;
  title?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdBy: string;
  isArchived: boolean;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InternalThreadParticipant {
  threadId: string;
  userId: string;
  organizationId: string;
  joinedAt: Date;
  lastReadAt: Date;
}

export type InternalMessageType = 'TEXT' | 'SYSTEM_ALERT' | 'ENTITY_LINK';

export interface InternalMessage {
  id: string;
  organizationId: string;
  threadId: string;
  senderId: string;
  content: string;
  messageType: InternalMessageType;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export type NotificationPriority = 'CRITICAL' | 'URGENT' | 'INFO';

export interface UserNotification {
  id: string;
  organizationId: string;
  recipientId: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  sourceType: string;
  sourceId?: string;
  deepLink?: string;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}
