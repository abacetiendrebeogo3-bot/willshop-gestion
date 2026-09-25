/**
 * WILLShop OS V2 — Routine Engine & Workflow Stack Application Services
 */

import { RoutineStep, RoutineType, WorkRoutine, WorkflowStackState } from '../../domain/entities/V2FoundationsEntities';
import { InMemoryWorkRoutineRepository } from '../../infrastructure/repositories/InMemoryV2Repositories';

export const COMMERCIAL_MY_DAY_STEPS = [
  'RELANCES',
  'ENGAGEMENTS',
  'QUESTIONS',
  'ORDERS_TO_FINALIZE',
  'PROBLEMS',
  'MONITORING',
  'FINISH',
];

export const CEO_MY_DIRECTION_STEPS = [
  'HIER',
  'ARGENT',
  'TEAM',
  'SALES',
  'DELIVERIES',
  'PROBLEMS',
  'INTELLIGENCE',
  'FINISH',
];

export class RoutineEngineService {
  constructor(private repo: InMemoryWorkRoutineRepository) {}

  async getOrCreateRoutine(
    userId: string,
    organizationId: string,
    routineType: RoutineType,
    routineDate: string = new Date().toISOString().split('T')[0]
  ): Promise<{ routine: WorkRoutine; steps: RoutineStep[] }> {
    const existing = await this.repo.getActiveRoutine(userId, organizationId, routineDate);
    if (existing) return existing;

    const stepKeys = routineType === 'COMMERCIAL_MY_DAY' ? COMMERCIAL_MY_DAY_STEPS : CEO_MY_DIRECTION_STEPS;
    return this.repo.createRoutine(
      {
        userId,
        organizationId,
        routineType,
        routineDate,
        startedAt: new Date(),
        status: 'IN_PROGRESS',
        totalActionsPlanned: 10,
        totalActionsCompleted: 0,
        totalActionsPostponed: 0,
      },
      stepKeys
    );
  }

  async advanceStep(routineId: string, currentStepKey: string): Promise<RoutineStep | null> {
    return this.repo.completeStep(routineId, currentStepKey);
  }

  async finishRoutine(routineId: string): Promise<WorkRoutine | null> {
    return this.repo.finishRoutine(routineId);
  }
}

export class WorkflowStackService {
  constructor(private repo: InMemoryWorkRoutineRepository) {}

  async pauseWorkflow(params: {
    organizationId: string;
    userId: string;
    routineId: string;
    pausedStep: string;
    stepContext?: Record<string, any>;
    interruptionReason: string;
    interruptionEntityType?: string;
    interruptionEntityId?: string;
  }): Promise<WorkflowStackState> {
    return this.repo.pushInterruption({
      ...params,
      isActive: true,
      pausedAt: new Date(),
    });
  }

  async getActiveInterruption(userId: string, organizationId: string): Promise<WorkflowStackState | null> {
    return this.repo.getActiveInterruption(userId, organizationId);
  }

  async resumeWorkflow(stackId: string): Promise<WorkflowStackState | null> {
    return this.repo.popInterruption(stackId);
  }
}
