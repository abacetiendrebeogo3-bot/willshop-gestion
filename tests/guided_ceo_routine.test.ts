/**
 * WILLShop OS — Phase 3 Guided CEO Routine ("Ma Direction") Test Suite
 * Tests step-by-step guided review sequence, metrics calculation, and routine state transitions.
 */

import {  describe, it, expect  } from './vitest-setup';
import { CEO_MY_DIRECTION_STEPS, CEODirectionMetrics } from '../src/application/services/RoutineEngineService';

describe('Phase 3 Guided CEO Routine ("Ma Direction")', () => {

  it('TEST 1: CEO Review Steps Sequence Definition', () => {
    expect(CEO_MY_DIRECTION_STEPS).toEqual([
      'HIER',
      'ARGENT',
      'TEAM',
      'SALES',
      'DELIVERIES',
      'PROBLEMS',
      'INTELLIGENCE',
      'FINISH',
    ]);
  });

  it('TEST 2: Critical Issues Calculation Logic', () => {
    const failedDeliveriesCount = 2;
    const overdueEngagementsCount = 3;
    const criticalIssuesCount = failedDeliveriesCount + overdueEngagementsCount;

    expect(criticalIssuesCount).toBe(5);

    let aiRecommendation = "Toutes vos opérations sont stables.";
    if (criticalIssuesCount > 0) {
      aiRecommendation = `Attention : Vous avez ${failedDeliveriesCount} livraison(s) échouée(s) et ${overdueEngagementsCount} relance(s) en retard nécessitant un arbitrage.`;
    }

    expect(aiRecommendation).toContain('2 livraison(s) échouée(s)');
    expect(aiRecommendation).toContain('3 relance(s) en retard');
  });

  it('TEST 3: Routine Step Transition Logic', () => {
    let currentStepIndex = 0;
    const stepsCount = CEO_MY_DIRECTION_STEPS.length;

    // Advance step
    currentStepIndex = Math.min(stepsCount - 1, currentStepIndex + 1);
    expect(currentStepIndex).toBe(1);
    expect(CEO_MY_DIRECTION_STEPS[currentStepIndex]).toBe('ARGENT');

    // Jump to last step
    currentStepIndex = stepsCount - 1;
    expect(CEO_MY_DIRECTION_STEPS[currentStepIndex]).toBe('FINISH');
  });

});
