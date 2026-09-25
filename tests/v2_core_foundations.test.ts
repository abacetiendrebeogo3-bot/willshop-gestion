/**
 * WILLShop OS V2 — Core Foundations & Phase 0/1 Automated Test Suite
 * Tests Customer Engagements, Work Routines, Workflow Stack Interruptions, Internal Messaging, and Notifications
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

import {
  InMemoryCustomerEngagementRepository,
  InMemoryWorkRoutineRepository,
  InMemoryInternalMessagingRepository,
  InMemoryUserNotificationRepository,
} from '../src/infrastructure/repositories/InMemoryV2Repositories';

import { CustomerEngagementService } from '../src/application/services/CustomerEngagementService';
import { RoutineEngineService, WorkflowStackService } from '../src/application/services/RoutineEngineService';
import { InternalMessagingService, NotificationService } from '../src/application/services/InternalMessagingService';

describe('WILLShop OS V2 — Core Foundations & Services Test Suite', () => {
  const engagementRepo = new InMemoryCustomerEngagementRepository();
  const routineRepo = new InMemoryWorkRoutineRepository();
  const messagingRepo = new InMemoryInternalMessagingRepository();
  const notificationRepo = new InMemoryUserNotificationRepository();

  const engagementService = new CustomerEngagementService(engagementRepo);
  const routineService = new RoutineEngineService(routineRepo);
  const stackService = new WorkflowStackService(routineRepo);
  const messagingService = new InternalMessagingService(messagingRepo);
  const notificationService = new NotificationService(notificationRepo);

  const testOrgId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';
  const commercialUserId = 'usr-comm-101';
  const ceoUserId = 'usr-ceo-999';
  const customerId = 'cust-505';

  // 1. Customer Engagements Tests
  test('Engagements: Should create and complete customer engagement', async () => {
    const engagement = await engagementService.createEngagement({
      organizationId: testOrgId,
      customerId,
      assignedTo: commercialUserId,
      title: 'Recontacter client pour confirmation de commande',
      dueAt: new Date(Date.now() + 3600 * 1000),
      priority: 'URGENT',
      source: 'COMMERCIAL_MANUAL',
    });

    assert.ok(engagement.id);
    assert.strictEqual(engagement.status, 'PENDING');
    assert.strictEqual(engagement.priority, 'URGENT');

    const completed = await engagementService.markAsCompleted(engagement.id, testOrgId, commercialUserId);
    assert.ok(completed);
    assert.strictEqual(completed.status, 'COMPLETED');
    assert.ok(completed.completedAt);
  });

  // 2. Work Routines & Steps Tests
  test('Work Routines: Should initialize COMMERCIAL_MY_DAY routine with step sequence', async () => {
    const { routine, steps } = await routineService.getOrCreateRoutine(commercialUserId, testOrgId, 'COMMERCIAL_MY_DAY', '2026-09-24');

    assert.ok(routine.id);
    assert.strictEqual(routine.status, 'IN_PROGRESS');
    assert.strictEqual(steps.length, 7); // RELANCES, ENGAGEMENTS, QUESTIONS, ORDERS_TO_FINALIZE, PROBLEMS, MONITORING, FINISH
    assert.strictEqual(steps[0].stepKey, 'RELANCES');

    const finished = await routineService.finishRoutine(routine.id);
    assert.ok(finished);
    assert.strictEqual(finished.status, 'COMPLETED');
  });

  // 3. Workflow Stack Interruption & Resume Tests
  test('Workflow Stack: Pause and resume workflow position', async () => {
    const { routine } = await routineService.getOrCreateRoutine(commercialUserId, testOrgId, 'COMMERCIAL_MY_DAY', '2026-09-25');

    const stack = await stackService.pauseWorkflow({
      organizationId: testOrgId,
      userId: commercialUserId,
      routineId: routine.id,
      pausedStep: 'QUESTIONS',
      interruptionReason: 'DELIVERY_FAILED_URGENT',
      interruptionEntityType: 'ORDER',
      interruptionEntityId: 'ord-881',
    });

    assert.ok(stack.id);
    assert.strictEqual(stack.isActive, true);

    const activeStack = await stackService.getActiveInterruption(commercialUserId, testOrgId);
    assert.strictEqual(activeStack?.id, stack.id);

    const resumed = await stackService.resumeWorkflow(stack.id);
    assert.ok(resumed);
    assert.strictEqual(resumed.isActive, false);
    assert.ok(resumed.resumedAt);
  });

  // 4. Internal Messaging Tests
  test('Internal Messaging: Create thread and send message between CEO and Commercial', async () => {
    const thread = await messagingService.createThread({
      organizationId: testOrgId,
      createdBy: ceoUserId,
      participantIds: [commercialUserId],
      title: 'Point sur la relance client #cust-505',
    });

    assert.ok(thread.id);

    const message = await messagingService.sendMessage({
      organizationId: testOrgId,
      threadId: thread.id,
      senderId: ceoUserId,
      content: 'Awa, peux-tu valider le paiement pour le client #cust-505 ?',
    });

    assert.ok(message.id);
    assert.strictEqual(message.content, 'Awa, peux-tu valider le paiement pour le client #cust-505 ?');

    const messages = await messagingService.getThreadMessages(thread.id, testOrgId);
    assert.strictEqual(messages.length, 1);
  });

  // 5. Notifications Tests
  test('Notifications: Dispatch and mark user notification as read', async () => {
    const notif = await notificationService.notify({
      organizationId: testOrgId,
      recipientId: commercialUserId,
      title: 'Nouveau message interne du CEO',
      body: 'Vous avez reçu une demande urgente concernant le client #cust-505',
      priority: 'URGENT',
      sourceType: 'INTERNAL_MESSAGE',
      deepLink: '/sales/my-day',
    });

    assert.ok(notif.id);
    assert.strictEqual(notif.priority, 'URGENT');

    const unread = await notificationService.getUnread(commercialUserId, testOrgId);
    assert.strictEqual(unread.length, 1);

    const read = await notificationService.markAsRead(notif.id, commercialUserId, testOrgId);
    assert.ok(read);
    assert.ok(read.readAt);
  });
});
