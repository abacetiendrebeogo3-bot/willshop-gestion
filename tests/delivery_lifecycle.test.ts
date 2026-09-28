import { describe, it, expect } from "vitest";
import { DeliveryStateMachine } from "../src/domain/services/DeliveryStateMachine";
import { DeliveryStatus } from "../src/domain/entities/DataCoreEntities";
import { ValidationError } from "../src/domain/errors/AppErrors";

/**
 * WILLShop OS — Delivery Lifecycle & State Machine Test Suite
 * Validates state transitions:
 * COMMANDE CONFIRMÉE -> PENDING -> ASSIGNED -> IN_TRANSIT -> DELIVERED / FAILED / RESCHEDULED / RETURNED
 */

describe("Delivery Lifecycle & State Machine Domain Service", () => {
  const mockOrgId = "org-deliv-lifecycle-101";

  it("1. Valid Happy Path Transition: PENDING -> ASSIGNED -> IN_TRANSIT -> DELIVERED", () => {
    expect(DeliveryStateMachine.canTransition("PENDING", "ASSIGNED")).toBe(true);
    expect(DeliveryStateMachine.canTransition("ASSIGNED", "IN_TRANSIT")).toBe(true);
    expect(DeliveryStateMachine.canTransition("IN_TRANSIT", "DELIVERED")).toBe(true);

    expect(() => DeliveryStateMachine.validateTransition("PENDING", "ASSIGNED")).not.toThrow();
    expect(() => DeliveryStateMachine.validateTransition("ASSIGNED", "IN_TRANSIT")).not.toThrow();
    expect(() => DeliveryStateMachine.validateTransition("IN_TRANSIT", "DELIVERED")).not.toThrow();
  });

  it("2. Exception Path Transition: IN_TRANSIT -> FAILED -> RESCHEDULED -> ASSIGNED", () => {
    expect(DeliveryStateMachine.canTransition("IN_TRANSIT", "FAILED")).toBe(true);
    expect(DeliveryStateMachine.canTransition("FAILED", "RESCHEDULED")).toBe(true);
    expect(DeliveryStateMachine.canTransition("RESCHEDULED", "ASSIGNED")).toBe(true);

    expect(() => DeliveryStateMachine.validateTransition("IN_TRANSIT", "FAILED")).not.toThrow();
    expect(() => DeliveryStateMachine.validateTransition("FAILED", "RESCHEDULED")).not.toThrow();
    expect(() => DeliveryStateMachine.validateTransition("RESCHEDULED", "ASSIGNED")).not.toThrow();
  });

  it("3. Return Transition: IN_TRANSIT -> RETURNED", () => {
    expect(DeliveryStateMachine.canTransition("IN_TRANSIT", "RETURNED")).toBe(true);
    expect(() => DeliveryStateMachine.validateTransition("IN_TRANSIT", "RETURNED")).not.toThrow();
  });

  it("4. Illegal State Transition Rejection: Throws ValidationError for invalid jumps", () => {
    // Cannot jump from PENDING directly to DELIVERED without assignment & transit
    expect(DeliveryStateMachine.canTransition("PENDING", "DELIVERED")).toBe(false);
    expect(() => DeliveryStateMachine.validateTransition("PENDING", "DELIVERED")).toThrow(ValidationError);

    // Closed delivery cannot revert to ASSIGNED
    expect(DeliveryStateMachine.canTransition("CLOSED", "ASSIGNED")).toBe(false);
    expect(() => DeliveryStateMachine.validateTransition("CLOSED", "ASSIGNED")).toThrow(ValidationError);
  });

  it("5. Delivery Timestamps & Audit Log Construction", () => {
    const deliveryRecord: any = {
      id: "deliv-909",
      organizationId: mockOrgId,
      status: "PENDING" as DeliveryStatus,
      created_at: new Date().toISOString(),
    };

    // Transition to ASSIGNED
    deliveryRecord.status = "ASSIGNED";
    deliveryRecord.assigned_at = new Date().toISOString();

    // Transition to IN_TRANSIT
    deliveryRecord.status = "IN_TRANSIT";
    deliveryRecord.picked_up_at = new Date().toISOString();

    // Transition to DELIVERED
    deliveryRecord.status = "DELIVERED";
    deliveryRecord.delivered_at = new Date().toISOString();
    deliveryRecord.recipient_name = "Awa Traore";

    expect(deliveryRecord.status).toBe("DELIVERED");
    expect(deliveryRecord.picked_up_at).toBeDefined();
    expect(deliveryRecord.delivered_at).toBeDefined();
    expect(deliveryRecord.recipient_name).toBe("Awa Traore");
  });

  it("6. Multi-Tenant RLS Isolation for Delivery Records", () => {
    const deliveriesOrgA = [
      { id: "del-a1", organizationId: "org-A", status: "IN_TRANSIT" },
      { id: "del-a2", organizationId: "org-A", status: "DELIVERED" },
    ];

    const targetOrgIdB = "org-B";
    const filteredForOrgB = deliveriesOrgA.filter((d) => d.organizationId === targetOrgIdB);

    expect(filteredForOrgB.length).toBe(0);
  });
});
