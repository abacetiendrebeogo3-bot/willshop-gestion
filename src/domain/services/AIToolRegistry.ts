/**
 * WILLShop OS — CEO AI Tool Registry
 * AUDIT FIX: Renamed conceptually to CEOAIToolRegistry to distinguish from AIToolsRegistry (Sales Agent).
 * The AIToolRegistry class is kept for backward compatibility with existing imports.
 * New code should reference it as CEOAIToolRegistry via the alias export below.
 * Schema-validated registry of tools available to the CEO AI Engine.
 * Pure Domain Service.
 */

export interface AIToolDefinition {
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
  permissionLevel: 'GREEN' | 'YELLOW' | 'RED';
  requiredRole: 'OWNER' | 'MANAGER' | 'COMMERCIAL' | 'VIEWER';
}

export class AIToolRegistry {
  private static tools: Map<string, AIToolDefinition> = new Map();

  static {
    AIToolRegistry.register({
      name: 'get_business_snapshot',
      description: 'Obtenir la vue synthétique instantanée de la santé globale de WillShop OS',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_sales_kpis',
      description: 'Obtenir les indicateurs clés de performance des ventes et revenus',
      parametersSchema: { type: 'object', properties: { period: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_financial_snapshot',
      description: 'Obtenir la situation exacte de la trésorerie et de la rentabilité',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'MANAGER',
    });

    AIToolRegistry.register({
      name: 'get_stock_risks',
      description: 'Lister les produits en stock bas ou en rupture critique',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'create_recommendation',
      description: 'Générer une recommandation managériale basée sur des preuves',
      parametersSchema: { type: 'object', properties: { title: { type: 'string' }, recommendation: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'MANAGER',
    });

    AIToolRegistry.register({
      name: 'create_approval_request',
      description: 'Soumettre une action sensible (YELLOW/RED) au centre d\'approbation',
      parametersSchema: { type: 'object', properties: { actionType: { type: 'string' }, payload: { type: 'object' } } },
      permissionLevel: 'YELLOW',
      requiredRole: 'MANAGER',
    });

    AIToolRegistry.register({
      name: 'request_automation',
      description: 'Déclencher un workflow d\'automatisation déterministe autorisé',
      parametersSchema: { type: 'object', properties: { ruleId: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'MANAGER',
    });

    // --- BUILD 11: TEAM & PRODUCTIVITY TOOLS ---
    AIToolRegistry.register({
      name: 'get_team_snapshot',
      description: 'Obtenir la vue synthétique de l\'équipe, membres actifs, tâches ouvertes, en retard et bloquées',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_employee_workload',
      description: 'Obtenir la charge de travail et le statut de surcharge/sous-charge par employé',
      parametersSchema: { type: 'object', properties: { employeeId: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'MANAGER',
    });

    AIToolRegistry.register({
      name: 'get_overdue_tasks',
      description: 'Lister les tâches en retard nécessitant une attention ou une réassignation',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_blocked_tasks',
      description: 'Lister les tâches bloquées avec les raisons du blocage',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_goal_progress',
      description: 'Obtenir l\'avancement des objectifs d\'entreprise, d\'équipe et individuels',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_employee_scorecard',
      description: 'Obtenir la fiche de performance contextualisée d\'un employé',
      parametersSchema: { type: 'object', properties: { employeeId: { type: 'string' }, period: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'MANAGER',
    });

    AIToolRegistry.register({
      name: 'get_team_performance',
      description: 'Obtenir l\'évaluation de performance globale de l\'équipe',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'MANAGER',
    });

    AIToolRegistry.register({
      name: 'get_work_plan',
      description: 'Obtenir le plan de travail quotidien priorisé d\'un membre de l\'équipe',
      parametersSchema: { type: 'object', properties: { employeeId: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    // --- BUILD 12: STRATEGY & GOALS TOOLS ---
    AIToolRegistry.register({
      name: 'get_strategy_snapshot',
      description: 'Obtenir la synthèse de la santé stratégique globale, vision et priorités',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_strategic_objectives',
      description: 'Lister les orientations et objectifs stratégiques principaux',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_goal_progress',
      description: 'Obtenir la progression exacte d\'un objectif relié aux KPI réels',
      parametersSchema: { type: 'object', properties: { goalId: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_goal_forecast',
      description: 'Obtenir la projection de trajectoire et le risque d\'échec d\'un objectif',
      parametersSchema: { type: 'object', properties: { goalId: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_key_results',
      description: 'Lister les résultats clés (Key Results) sous un objectif',
      parametersSchema: { type: 'object', properties: { goalId: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_initiatives',
      description: 'Lister les initiatives stratégiques actives, planifiées ou bloquées',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_initiative_score',
      description: 'Obtenir le score de priorisation d\'une initiative (Impact vs Effort vs Risque)',
      parametersSchema: { type: 'object', properties: { initiativeId: { type: 'string' } } },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_strategy_risks',
      description: 'Lister les risques stratégiques évalués (Probabilité x Impact)',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_strategy_dependencies',
      description: 'Analyser les dépendances d\'exécutions stratégiques',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_90_day_plan',
      description: 'Obtenir la vue synthétique du plan stratégique à 90 jours (3-5 priorités)',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_strategy_roadmap',
      description: 'Obtenir la feuille de route stratégique et le chronogramme d\'exécution',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'VIEWER',
    });

    AIToolRegistry.register({
      name: 'get_strategic_decisions',
      description: 'Consulter l\'historique des décisions stratégiques et leurs réévaluations prévues',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'MANAGER',
    });

    // --- BUILD 13: WILTY PERSONAL OS TOOLS ---
    AIToolRegistry.register({
      name: 'get_personal_snapshot',
      description: 'Obtenir la vue synthétique instantanée de la vie personnelle de Willy Tiendré',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_personal_today_tasks',
      description: 'Obtenir la liste des tâches personnelles prioritaires du jour',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_personal_goal_progress',
      description: 'Obtenir l\'avancement et les trajectoires des objectifs personnels',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_personal_financial_summary',
      description: 'Obtenir la situation financière personnelle exacte (comptes isolés)',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_personal_net_worth',
      description: 'Obtenir le calcul du patrimoine personnel (Assets - Liabilities)',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_personal_budget_status',
      description: 'Obtenir l\'état des budgets personnels par catégorie',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_personal_projects',
      description: 'Lister les projets personnels actifs, bloqués ou planifiés',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_personal_habits_streak',
      description: 'Obtenir le bilan des habitudes et des séries de régularité (streaks)',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_personal_learning_progress',
      description: 'Obtenir l\'avancement des compétences et apprentissages personnels',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_personal_decisions',
      description: 'Consulter le journal des décisions personnelles et leurs réévaluations',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_wilty_daily_briefing',
      description: 'Générer le briefing du matin personnalisé pour Willy Tiendré',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });

    AIToolRegistry.register({
      name: 'get_wilty_weekly_review',
      description: 'Générer le bilan hebdomadaire personnel avec analyse Stop/Start/Continue',
      parametersSchema: { type: 'object', properties: {} },
      permissionLevel: 'GREEN',
      requiredRole: 'OWNER',
    });
  }

  public static register(tool: AIToolDefinition): void {
    AIToolRegistry.tools.set(tool.name, tool);
  }

  public static getTool(name: string): AIToolDefinition | null {
    return AIToolRegistry.tools.get(name) || null;
  }

  public static listTools(): AIToolDefinition[] {
    return Array.from(AIToolRegistry.tools.values());
  }
}

// AUDIT FIX: Semantic alias — use CEOAIToolRegistry in new code for clarity
// AIToolRegistry kept for backward compatibility
export { AIToolRegistry as CEOAIToolRegistry };
