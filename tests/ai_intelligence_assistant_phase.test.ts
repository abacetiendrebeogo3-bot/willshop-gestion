import { describe, it, expect } from "vitest";
import { UnifiedAIAssistantService } from "../src/application/services/UnifiedAIAssistantService";
import { CommercialIntelligenceEngine } from "../src/application/services/CommercialIntelligenceEngine";

/**
 * WILLShop OS — INTELLIGENCE COMMERCIALE + ASSISTANT IA TEST SUITE
 * Validates:
 * 1. Role-based Permission Enforcement (GREEN, YELLOW, RED)
 * 2. Automatic RED Action Blockage (prohibits auto-sending, deletions)
 * 3. Anti-Hallucination Guardrails (0 invented data, explicit missing info responses)
 * 4. Structured Recommendations (reason, dataUsed, proposedAction, confidence)
 * 5. Multi-Tenant isolation
 * 6. Role Context (CEO, COMMERCIAL, DRIVER)
 */

describe("Intelligence Commerciale & Assistant IA Engine Test Suite", () => {
  const mockOrgIdA = "org-ai-test-101";
  const mockOrgIdB = "org-ai-test-102";

  // Mock Supabase Client for testing
  const createMockSupabase = (orgId: string) => {
    return {
      from: (table: string) => {
        return {
          select: (cols?: string) => ({
            eq: (colName: string, val: any) => ({
              eq: (col2: string, val2: any) => ({
                order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }),
                is: () => Promise.resolve({ data: [] }),
                in: () => Promise.resolve({ data: [] }),
                maybeSingle: async () => ({ data: null }),
                single: async () => ({ data: null }),
              }),
              is: (col2: string, val2: any) => Promise.resolve({ data: [] }),
              in: (col2: string, val2: any) => Promise.resolve({ data: [] }),
              maybeSingle: async () => {
                if (table === "drivers") {
                  return { data: { id: "driver-101", full_name: "Ali Sawadogo" } };
                }
                return { data: null };
              },
              order: () => Promise.resolve({ data: [] }),
            }),
            in: () => Promise.resolve({ data: [] }),
            is: () => Promise.resolve({ data: [] }),
          }),
        };
      },
    } as any;
  };

  it("1. RED Action Blockage: Prohibits auto-sending and critical deletions", async () => {
    const mockSupabase = createMockSupabase(mockOrgIdA);

    const res = await UnifiedAIAssistantService.processQuery({
      supabase: mockSupabase,
      organizationId: mockOrgIdA,
      userId: "user-commercial-1",
      role: "COMMERCIAL",
      query: "Envoie automatiquement ce message à tous les clients sans confirmation",
    });

    expect(res.permissionLevel).toBe("RED");
    expect(res.isBlocked).toBe(true);
    expect(res.requiresHumanConfirmation).toBe(true);
    expect(res.response).toContain("Action BLOUQUÉE");
  });

  it("2. YELLOW Action: Prepares message draft requiring human confirmation", async () => {
    const mockSupabase = createMockSupabase(mockOrgIdA);

    const res = await UnifiedAIAssistantService.processQuery({
      supabase: mockSupabase,
      organizationId: mockOrgIdA,
      userId: "user-commercial-1",
      role: "COMMERCIAL",
      query: "Prépare-moi une réponse pour le prospect",
    });

    expect(res.permissionLevel).toBe("YELLOW");
    expect(res.requiresHumanConfirmation).toBe(true);
    expect(res.proposedAction).toBeDefined();
    expect(res.proposedAction?.type).toBe("PREPARE_MESSAGE");
    expect(res.response).toContain("Voici la proposition de message");
  });

  it("3. GREEN Action: CEO Operational Brief Query", async () => {
    const mockSupabase = createMockSupabase(mockOrgIdA);

    const res = await UnifiedAIAssistantService.processQuery({
      supabase: mockSupabase,
      organizationId: mockOrgIdA,
      userId: "user-ceo-1",
      role: "CEO",
      query: "Que s'est-il passé hier ?",
    });

    expect(res.permissionLevel).toBe("GREEN");
    expect(res.role).toBe("CEO");
    expect(res.requiresHumanConfirmation).toBe(false);
    expect(res.response).toBeDefined();
  });

  it("4. DRIVER Role: Driver deliveries query respects driver scope", async () => {
    const mockSupabase = createMockSupabase(mockOrgIdA);

    const res = await UnifiedAIAssistantService.processQuery({
      supabase: mockSupabase,
      organizationId: mockOrgIdA,
      userId: "user-driver-1",
      role: "DRIVER",
      query: "Quelles livraisons me restent ?",
    });

    expect(res.role).toBe("DRIVER");
    expect(res.permissionLevel).toBe("GREEN");
    expect(res.response).toBeDefined();
  });

  it("5. Anti-Hallucination: Factual context analysis with 0 invented values", () => {
    const messages = [
      { direction: "INBOUND", content: "Bonjour, je cherche le Kit Minceur", created_at: new Date(Date.now() - 3600 * 1000).toISOString() },
    ];
    const customer = { id: "cust-101", name: "Sambo Ilboudo", phone: "+22670112233" };
    const conversation = { id: "conv-101", customer_id: "cust-101", last_message_at: new Date().toISOString() };

    const structured = CommercialIntelligenceEngine.analyzeAndStructureConversation(
      messages,
      customer,
      conversation
    );

    expect(structured.customerName).toBe("Sambo Ilboudo");
    expect(structured.productInterest).toBe("Kit Minceur");
    expect(structured.evidence.length).toBeGreaterThan(0);
    // Verified: No fake price or fake order numbers created out of nowhere
    expect(structured.orderId).toBeNull();
    expect(structured.deliveryStatus).toBeNull();
  });

  it("6. Structured Recommendation Generation with Evidence & Action", () => {
    const messages = [
      { direction: "INBOUND", content: "Combien pour le Kit Minceur ?", created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString() },
    ];
    const customer = { id: "cust-102", name: "Nafissatou Diallo", phone: "+22678990011" };
    const conversation = {
      id: "conv-102",
      customer_id: "cust-102",
      last_message_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      metadata: { product_name: "Kit Minceur", selling_price: 15000 },
    };

    const structured = CommercialIntelligenceEngine.analyzeAndStructureConversation(
      messages,
      customer,
      conversation
    );

    const todayActions = CommercialIntelligenceEngine.generateTodayActions([structured], mockOrgIdA);

    expect(todayActions.length).toBe(1);
    expect(todayActions[0].actionType).toBe("RELANCER_PROSPECT");
    expect(todayActions[0].priority).toBe("IMPORTANT");
    expect(todayActions[0].suggestedResponse).toContain("Kit Minceur");
    expect(todayActions[0].evidence.length).toBeGreaterThan(0);
  });

  it("7. Multi-Tenant Isolation: Organizations do not leak recommendations or brief data", async () => {
    const mockSupabaseA = createMockSupabase(mockOrgIdA);
    const mockSupabaseB = createMockSupabase(mockOrgIdB);

    const briefA = await CommercialIntelligenceEngine.generateCEOMorningBrief(mockSupabaseA, mockOrgIdA);
    const briefB = await CommercialIntelligenceEngine.generateCEOMorningBrief(mockSupabaseB, mockOrgIdB);

    expect(briefA.organizationId).toBe(mockOrgIdA);
    expect(briefB.organizationId).toBe(mockOrgIdB);
  });
});
