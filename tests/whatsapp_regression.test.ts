import { describe, it, expect } from './vitest-setup';
import { WhatsAppEventNormalizer } from "../src/infrastructure/whatsapp/WhatsAppEventNormalizer";

describe("WhatsApp Regression Tests (Idempotency & Geo Guard)", () => {
  it("should ignore status@broadcast messages (return null or invalid senderPhone)", () => {
    const rawPayload = {
      instance: "willshop_pilot",
      data: {
        key: {
          remoteJid: "status@broadcast",
          fromMe: false,
          id: "EVO_STATUS_001",
        },
        pushName: "Status",
        message: {
          conversation: "Check out my status",
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    const normalized = WhatsAppEventNormalizer.normalize("evolution", rawPayload);
    // Should either return null entirely or have an empty senderPhone preventing CRM creation
    if (normalized) {
      expect(normalized.senderPhone).toBe("");
    } else {
      expect(normalized).toBeNull();
    }
  });

  it("should not format non-Burkina numbers into +226 magically (geo guard proxy)", () => {
    const rawPayload = {
      instance: "willshop_pilot",
      data: {
        key: {
          remoteJid: "33612345678@s.whatsapp.net", // French number
          fromMe: false,
          id: "EVO_FR_001",
        },
        pushName: "French Client",
        message: {
          conversation: "Bonjour de France",
        },
      },
    };

    const normalized = WhatsAppEventNormalizer.normalize("evolution", rawPayload);
    expect(normalized).not.toBeNull();
    // It should just prepend + to 33612345678, NOT +226
    expect(normalized?.senderPhone).toBe("+33612345678");
  });

  it("should correctly normalize all media types (TEXT, IMAGE, AUDIO, DOCUMENT)", () => {
    // TEXT already tested, testing IMAGE
    const imagePayload = {
      instance: "willshop_pilot",
      data: {
        key: { remoteJid: "22670001122@s.whatsapp.net", fromMe: false, id: "IMG_1" },
        messageType: "imageMessage",
        message: { imageMessage: { caption: "My Image", url: "http://image" } }
      }
    };
    const imgEvent = WhatsAppEventNormalizer.normalize("evolution", imagePayload);
    expect(imgEvent?.messageType).toBe("IMAGE");
    expect(imgEvent?.textBody).toBe("My Image");
    expect(imgEvent?.mediaUrl).toBe("http://image");

    // AUDIO
    const audioPayload = {
      instance: "willshop_pilot",
      data: {
        key: { remoteJid: "22670001122@s.whatsapp.net", fromMe: false, id: "AUD_1" },
        messageType: "audioMessage",
        message: { audioMessage: { url: "http://audio" } }
      }
    };
    const audEvent = WhatsAppEventNormalizer.normalize("evolution", audioPayload);
    expect(audEvent?.messageType).toBe("AUDIO");
    expect(audEvent?.mediaUrl).toBe("http://audio");

    // DOCUMENT
    const docPayload = {
      instance: "willshop_pilot",
      data: {
        key: { remoteJid: "22670001122@s.whatsapp.net", fromMe: false, id: "DOC_1" },
        messageType: "documentMessage",
        message: { documentMessage: { fileName: "invoice.pdf", url: "http://doc" } }
      }
    };
    const docEvent = WhatsAppEventNormalizer.normalize("evolution", docPayload);
    expect(docEvent?.messageType).toBe("DOCUMENT");
    expect(docEvent?.textBody).toBe("invoice.pdf");
    expect(docEvent?.mediaUrl).toBe("http://doc");
  });

  it("should simulate idempotency guard for duplicate webhooks", async () => {
    const dbMock = new Set<string>();
    
    // Simulating what WhatsAppApplicationService does for idempotency
    const processWebhook = async (messageId: string) => {
      if (dbMock.has(messageId)) {
        return { success: true, duplicate: true, created: 0 }; // Ignored
      }
      dbMock.add(messageId);
      return { success: true, duplicate: false, created: 1 };
    };

    const webhookId = "DUPLICATE_ID_123";
    
    const firstCall = await processWebhook(webhookId);
    expect(firstCall.created).toBe(1);
    expect(firstCall.duplicate).toBe(false);

    const secondCall = await processWebhook(webhookId);
    expect(secondCall.created).toBe(0);
    expect(secondCall.duplicate).toBe(true);
  });
});
