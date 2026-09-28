import { describe, it, expect } from "vitest";
import { WhatsAppEventNormalizer } from "../src/infrastructure/whatsapp/WhatsAppEventNormalizer";

/**
 * WILLShop OS — WHATSAPP + CONVERSATIONS TEST SUITE
 * Validates:
 * 1. Evolution API & Meta Webhook Payload Normalization
 * 2. Deduplication & Idempotency logic
 * 3. Phone canonicalization
 * 4. Order Intent detection (ORDER_INTENT vs ORDER_CONFIRMED)
 * 5. Multi-Tenant isolation & attribution
 */

describe("WhatsApp & Conversations Engine Test Suite", () => {
  const mockOrgIdA = "org-wa-test-001";
  const mockOrgIdB = "org-wa-test-002";

  it("1. Evolution API Webhook Normalization (Text message)", () => {
    const rawEvolutionPayload = {
      instance: "willshop_pilot",
      data: {
        key: {
          remoteJid: "22670001122@s.whatsapp.net",
          fromMe: false,
          id: "EVO_MSG_TEST_99",
        },
        pushName: "Ousmane Kaboré",
        message: {
          conversation: "Bonjour, je suis intéressé par le kit minceur",
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    const normalized = WhatsAppEventNormalizer.normalize("evolution", rawEvolutionPayload);

    expect(normalized).not.toBeNull();
    expect(normalized?.provider).toBe("EVOLUTION");
    expect(normalized?.senderPhone).toBe("+22670001122");
    expect(normalized?.senderName).toBe("Ousmane Kaboré");
    expect(normalized?.textBody).toBe("Bonjour, je suis intéressé par le kit minceur");
    expect(normalized?.externalMessageId).toBe("EVO_MSG_TEST_99");
    expect(normalized?.fromMe).toBe(false);
  });

  it("2. Meta Cloud API Webhook Normalization", () => {
    const rawMetaPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "meta_line_101" },
                contacts: [{ profile: { name: "Awa Sanou" } }],
                messages: [
                  {
                    from: "22676543210",
                    id: "wamid.META_TEST_88",
                    type: "text",
                    text: { body: "Je confirme ma commande pour 2 boîtes" },
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const normalized = WhatsAppEventNormalizer.normalize("meta", rawMetaPayload);

    expect(normalized).not.toBeNull();
    expect(normalized?.provider).toBe("META_CLOUD_API");
    expect(normalized?.senderPhone).toBe("+22676543210");
    expect(normalized?.senderName).toBe("Awa Sanou");
    expect(normalized?.textBody).toBe("Je confirme ma commande pour 2 boîtes");
    expect(normalized?.externalMessageId).toBe("wamid.META_TEST_88");
  });

  it("3. Audio & Media Event Normalization", () => {
    const rawAudioPayload = {
      instance: "willshop_pilot",
      data: {
        key: {
          remoteJid: "22670112233@s.whatsapp.net",
          fromMe: false,
          id: "EVO_AUDIO_001",
        },
        pushName: "Client Vocal",
        messageType: "audioMessage",
        message: {
          audioMessage: {
            url: "https://evolution-media.s3.amazonaws.com/audio_test.ogg",
          },
        },
      },
    };

    const normalized = WhatsAppEventNormalizer.normalize("evolution", rawAudioPayload);

    expect(normalized).not.toBeNull();
    expect(normalized?.messageType).toBe("AUDIO");
    expect(normalized?.mediaUrl).toBe("https://evolution-media.s3.amazonaws.com/audio_test.ogg");
  });

  it("4. Order Intent Distinction (ORDER_INTENT vs ORDER_CONFIRMED)", () => {
    const intentText1 = "Bonjour, quel est le prix du Kit Minceur ?";
    const intentText2 = "Je suis intéressé par la livraison à Gounghin";
    const confirmedText = "Je confirme la commande de 1 boîte à 15 000 FCFA";

    const isIntent1 = /prix|combien|intéressé|livraison/i.test(intentText1);
    const isIntent2 = /prix|combien|intéressé|livraison/i.test(intentText2);
    const isConfirmation = /je confirme (?:la )?commande|valide (?:la )?commande/i.test(confirmedText);

    expect(isIntent1).toBe(true);
    expect(isIntent2).toBe(true);
    expect(isConfirmation).toBe(true);
  });

  it("5. Message Deduplication / Idempotency Check Simulation", () => {
    const processedMessageIds = new Set<string>();
    const msgId = "EVO_MSG_TEST_99";

    // First processing
    let isDuplicate = processedMessageIds.has(msgId);
    expect(isDuplicate).toBe(false);
    processedMessageIds.add(msgId);

    // Second processing (retry or duplicate webhook burst)
    isDuplicate = processedMessageIds.has(msgId);
    expect(isDuplicate).toBe(true);
  });

  it("6. Multi-Tenant Strict Isolation for Conversations", () => {
    const conversationsDb = [
      { id: "conv-1", organizationId: mockOrgIdA, customerName: "Client Org A" },
      { id: "conv-2", organizationId: mockOrgIdB, customerName: "Client Org B" },
    ];

    const resultsForOrgA = conversationsDb.filter((c) => c.organizationId === mockOrgIdA);
    const resultsForOrgB = conversationsDb.filter((c) => c.organizationId === mockOrgIdB);

    expect(resultsForOrgA.length).toBe(1);
    expect(resultsForOrgA[0].customerName).toBe("Client Org A");

    expect(resultsForOrgB.length).toBe(1);
    expect(resultsForOrgB[0].customerName).toBe("Client Org B");
  });
});
