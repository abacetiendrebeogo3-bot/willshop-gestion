/**
 * WILLShop OS — Wilty Daily Briefing Service
 * Pure Domain Service — Generates the Personal Life CEO Daily Briefing for Willy Tiendré.
 */

import {
  PersonalGoal,
  PersonalTask,
  PersonalProject,
  PersonalFinancialAccount,
  PersonalHabit,
  PersonalLearningItem,
} from '../entities/PersonalEntities';

export interface WiltyDailyBriefing {
  userId: string;
  briefingDate: string; // 'YYYY-MM-DD'
  situationSummary: string;
  topPriorityNumber1: string;
  todayTasks: PersonalTask[];
  goalHighlights: PersonalGoal[];
  financialOverview: {
    totalCash: number;
    currency: string;
  };
  activeProjectsCount: number;
  blockedProjectsCount: number;
  learningSessionPlanned?: string;
  alerts: string[];
  mainRecommendation: string;
}

export class WiltyDailyBriefingService {
  public static generateDailyBriefing(
    userId: string,
    goals: PersonalGoal[],
    tasks: PersonalTask[],
    projects: PersonalProject[],
    habits: PersonalHabit[],
    learningItems: PersonalLearningItem[],
    accounts: PersonalFinancialAccount[],
    now: Date = new Date()
  ): WiltyDailyBriefing {
    const todayISO = now.toISOString().split('T')[0];

    const todayTasks = tasks.filter(
      (t) =>
        t.status !== 'DONE' &&
        t.status !== 'CANCELLED' &&
        (!t.dueDate || new Date(t.dueDate).toISOString().split('T')[0] <= todayISO)
    );

    const urgentTasks = todayTasks.filter((t) => t.priority === 'CRITICAL' || t.priority === 'HIGH');
    const blockedProjects = projects.filter((p) => p.status === 'BLOCKED');

    const totalCash = accounts.reduce((acc, a) => acc + a.currentBalance, 0);

    let topPriority = 'Continuer l\'exécution des objectifs personnels prioritaires.';
    if (urgentTasks.length > 0) {
      topPriority = `Priorité #1: Traiter '${urgentTasks[0].title}' (Tâche critique).`;
    } else if (todayTasks.length > 0) {
      topPriority = `Priorité #1: Avancer sur '${todayTasks[0].title}'.`;
    }

    const alerts: string[] = [];
    if (blockedProjects.length > 0) {
      alerts.push(`${blockedProjects.length} projet(s) personnel(s) bloqué(s).`);
    }

    const activeGoalsAtRisk = goals.filter((g) => g.status === 'ACTIVE' && g.progressPercent < 30);
    if (activeGoalsAtRisk.length > 0) {
      alerts.push(`${activeGoalsAtRisk.length} objectif(s) personnel(s) nécessite(nt) un ajustement de fréquence.`);
    }

    if (alerts.length === 0) {
      alerts.push('Situation personnelle fluide et équilibrée.');
    }

    const inProgressLearning = learningItems.find((l) => l.status === 'IN_PROGRESS');

    return {
      userId,
      briefingDate: todayISO,
      situationSummary: `Bonjour. Vous avez ${todayTasks.length} tâche(s) au programme aujourd'hui et ${accounts.length} compte(s) personnels actifs.`,
      topPriorityNumber1: topPriority,
      todayTasks,
      goalHighlights: goals.filter((g) => g.status === 'ACTIVE').slice(0, 3),
      financialOverview: {
        totalCash: Math.round(totalCash * 100) / 100,
        currency: 'FCFA',
      },
      activeProjectsCount: projects.filter((p) => p.status === 'ACTIVE').length,
      blockedProjectsCount: blockedProjects.length,
      learningSessionPlanned: inProgressLearning ? inProgressLearning.title : undefined,
      alerts,
      mainRecommendation: urgentTasks.length > 0
        ? `Consacrez votre première heure de la journée à finaliser '${urgentTasks[0].title}'.`
        : 'Maintenez la dynamique sur vos habitudes quotidiennes.',
    };
  }
}
