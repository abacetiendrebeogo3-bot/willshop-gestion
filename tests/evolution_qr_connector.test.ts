import { test, describe } from 'node:test';
import assert from 'node:assert';
import { EvolutionWhatsAppAdapter } from '../src/infrastructure/whatsapp/EvolutionWhatsAppAdapter';
import { WhatsAppEventNormalizer } from '../src/infrastructure/whatsapp/WhatsAppEventNormalizer';

describe('Evolution WhatsApp Real QR & Instance Management Test Suite', () => {
  const adapter = new EvolutionWhatsAppAdapter('https://mock-evolution.local', 'test-key');

  test('EvolutionWhatsAppAdapter detects valid configuration', () => {
    assert.strictEqual(adapter.isConfigured(), true);
    assert.strictEqual(adapter.getConfigError(), null);

    const emptyAdapter = new EvolutionWhatsAppAdapter('', '');
    assert.strictEqual(emptyAdapter.isConfigured(), false);
    assert.ok(emptyAdapter.getConfigError()?.includes('Evolution API'));
  });

  test('EvolutionWhatsAppAdapter exposes instance administration methods', () => {
    assert.strictEqual(typeof adapter.createInstance, 'function');
    assert.strictEqual(typeof adapter.getConnectionState, 'function');
    assert.strictEqual(typeof adapter.getQrCode, 'function');
    assert.strictEqual(typeof adapter.setWebhook, 'function');
    assert.strictEqual(typeof adapter.logoutInstance, 'function');
    assert.strictEqual(typeof adapter.getInstanceOwnerInfo, 'function');
  });

  test('WhatsAppEventNormalizer correctly normalizes Evolution webhook payload with instance identity', () => {
    const rawPayload = {
      event: 'messages.upsert',
      instance: 'ws_org_a0eebc999c0b',
      data: {
        key: {
          remoteJid: '22670000001@s.whatsapp.net',
          fromMe: false,
          id: 'EVO_MSG_998877',
        },
        pushName: 'Moussa Ouattara',
        message: {
          conversation: 'Bonjour WILLShop',
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    const event = WhatsAppEventNormalizer.normalize('evolution', rawPayload);
    assert.ok(event);
    assert.strictEqual(event?.provider, 'EVOLUTION');
    assert.strictEqual(event?.providerIdentity, 'ws_org_a0eebc999c0b');
    assert.strictEqual(event?.senderPhone, '+22670000001');
    assert.strictEqual(event?.senderName, 'Moussa Ouattara');
    assert.strictEqual(event?.textBody, 'Bonjour WILLShop');
    assert.strictEqual(event?.fromMe, false);
    assert.strictEqual(event?.externalMessageId, 'EVO_MSG_998877');
  });

  test('WhatsAppEventNormalizer detects smartphone manual reply (fromMe: true)', () => {
    const rawPayload = {
      event: 'messages.upsert',
      instance: 'ws_org_a0eebc999c0b',
      data: {
        key: {
          remoteJid: '22670000001@s.whatsapp.net',
          fromMe: true,
          id: 'EVO_SENT_HUMAN_123',
        },
        pushName: 'Commercial WILLShop',
        message: {
          conversation: 'Bonjour Moussa, je prends le relais.',
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    const event = WhatsAppEventNormalizer.normalize('evolution', rawPayload);
    assert.ok(event);
    assert.strictEqual(event?.fromMe, true);
    assert.strictEqual(event?.textBody, 'Bonjour Moussa, je prends le relais.');
  });

  test('EvolutionWhatsAppAdapter supports Demo mode simulation seamlessly', async () => {
    const demoAdapter = new EvolutionWhatsAppAdapter('DEMO', '');
    assert.strictEqual(demoAdapter.isDemo(), true);
    assert.strictEqual(demoAdapter.isConfigured(), true);
    assert.strictEqual(demoAdapter.getConfigError(), null);

    const instResult = await demoAdapter.createInstance('ws_org_demo1234', undefined, '+22672019524');
    assert.strictEqual(instResult.success, true);
    assert.strictEqual(instResult.status, 'CONNECTED');
    assert.ok(instResult.qrcode?.base64);

    const state = await demoAdapter.getConnectionState('ws_org_demo1234');
    assert.strictEqual(state.state, 'CONNECTED');
    assert.strictEqual(state.phoneNumber, '+22672019524');

    const sendRes = await demoAdapter.sendTextMessage('ws_org_demo1234', {
      toPhoneNumber: '+22670000000',
      messageText: 'Test message démo',
    });
    assert.strictEqual(sendRes.status, 'SENT');
    assert.ok(sendRes.externalMessageId?.startsWith('DEMO-MSG-'));

    // Test disconnection
    await demoAdapter.logoutInstance('ws_org_demo1234');
    const disconnectedState = await demoAdapter.getConnectionState('ws_org_demo1234');
    assert.strictEqual(disconnectedState.state, 'DISCONNECTED');
  });
});
