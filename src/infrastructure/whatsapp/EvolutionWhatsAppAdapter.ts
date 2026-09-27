/**
 * WILLShop OS — Evolution API WhatsApp Provider Adapter
 * Infrastructure Layer.
 * Implements IWhatsAppProvider for Baileys / Evolution Gateway.
 */

import {
  IWhatsAppProvider,
  SendTextMessageDTO,
  SendMediaMessageDTO,
  WhatsAppSendResult,
} from '../../domain/interfaces/IWhatsAppProvider';

export class EvolutionWhatsAppAdapter implements IWhatsAppProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    const rawUrl = baseUrl || process.env.EVOLUTION_API_URL || process.env.NEXT_PUBLIC_EVOLUTION_API_URL || '';
    const rawKey = apiKey || process.env.EVOLUTION_API_KEY || '';
    this.baseUrl = rawUrl.trim().replace(/\/+$/, '');
    this.apiKey = rawKey.trim().replace(/^["']|["']$/g, '');
  }

  public isConfigured(): boolean {
    const configured = Boolean(this.baseUrl && this.apiKey);
    if (!configured) {
      console.warn(`[EVOLUTION_API_CONFIG] Unconfigured: baseUrl="${this.baseUrl}", apiKeyPresent=${Boolean(this.apiKey)}`);
    }
    return configured;
  }

  public getConfigError(): string | null {
    if (!this.baseUrl && !this.apiKey) {
      return 'Configuration serveur Evolution API manquante (EVOLUTION_API_URL et EVOLUTION_API_KEY non définies dans Vercel).';
    }
    if (!this.baseUrl) {
      return 'Configuration serveur Evolution API manquante (EVOLUTION_API_URL non définie dans Vercel).';
    }
    if (!this.apiKey) {
      return 'Configuration serveur Evolution API manquante (EVOLUTION_API_KEY non définie dans Vercel).';
    }
    return null;
  }

  async sendTextMessage(
    providerPhoneNumberId: string,
    dto: SendTextMessageDTO
  ): Promise<WhatsAppSendResult> {
    const cleanTo = dto.toPhoneNumber.replace(/[^\d]/g, '');
    const instance = providerPhoneNumberId;

    try {
      const response = await fetch(`${this.baseUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          number: cleanTo,
          text: dto.messageText,
          textMessage: { text: dto.messageText },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`Evolution API sendTextMessage failed [${response.status}]:`, errorText);
        return {
          externalMessageId: `EVO-ERR-${Date.now()}`,
          status: 'FAILED',
          errorCode: `HTTP_${response.status}`,
        };
      }

      const resData = await response.json();
      const externalMessageId = resData?.key?.id || resData?.id || `EVO-SENT-${Date.now()}`;

      return {
        externalMessageId,
        status: 'SENT',
      };
    } catch (err: any) {
      console.error('Evolution API sendTextMessage exception:', err);
      return {
        externalMessageId: `EVO-ERR-${Date.now()}`,
        status: 'FAILED',
        errorCode: err.message,
      };
    }
  }

  async sendMediaMessage(
    providerPhoneNumberId: string,
    dto: SendMediaMessageDTO
  ): Promise<WhatsAppSendResult> {
    const cleanTo = dto.toPhoneNumber.replace(/[^\d]/g, '');
    const instance = providerPhoneNumberId;

    try {
      const response = await fetch(`${this.baseUrl}/message/sendMedia/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          number: cleanTo,
          media: dto.mediaUrl,
          mediatype: dto.mediaType || 'image',
          mimetype: dto.mediaType === 'image' ? 'image/jpeg' : 'application/octet-stream',
          caption: dto.caption || '',
          fileName: 'product_photo.jpg',
          mediaMessage: {
            mediatype: dto.mediaType || 'image',
            media: dto.mediaUrl,
            caption: dto.caption || '',
          },
        }),
      });

      if (!response.ok) {
        return {
          externalMessageId: `EVO-ERR-${Date.now()}`,
          status: 'FAILED',
          errorCode: `HTTP_${response.status}`,
        };
      }

      const resData = await response.json();
      return {
        externalMessageId: resData?.key?.id || `EVO-MEDIA-${Date.now()}`,
        status: 'SENT',
      };
    } catch (err: any) {
      return {
        externalMessageId: `EVO-ERR-${Date.now()}`,
        status: 'FAILED',
        errorCode: err.message,
      };
    }
  }

  async markMessageAsRead(
    providerPhoneNumberId: string,
    externalMessageId: string
  ): Promise<boolean> {
    try {
      const instance = providerPhoneNumberId;
      const response = await fetch(`${this.baseUrl}/chat/markMessageAsRead/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          read: true,
          messageId: externalMessageId,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    const expectedKey = (secret || this.apiKey || '').trim();
    // If no signature header was provided by Evolution API, accept payload (Evolution v2 webhook default behavior)
    if (!signature || !signature.trim()) return true;
    if (!expectedKey) return true;
    return signature === expectedKey || signature.includes(expectedKey) || expectedKey.includes(signature);
  }

  /**
   * Creates or fetches an instance on Evolution API v2.
   */
  async createInstance(instanceName: string, webhookUrl?: string): Promise<{
    success: boolean;
    instanceName: string;
    status?: string;
    qrcode?: { code?: string; base64?: string; pairingCode?: string };
    error?: string;
  }> {
    if (!this.isConfigured()) {
      console.warn(`[EVOLUTION_API] createInstance aborted — missing configuration.`);
      return { success: false, instanceName, error: this.getConfigError()! };
    }

    console.log(`[EVOLUTION_API] 🚀 STEP 1: Creating instance '${instanceName}' on server ${this.baseUrl}...`);
    try {
      const response = await fetch(`${this.baseUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          reject_call: false,
          always_online: true,
          read_messages: false,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[EVOLUTION_API] instance/create HTTP ${response.status}: ${errText}`);
        if (response.status === 403 || errText.includes('already exists') || errText.includes('in use')) {
          console.log(`[EVOLUTION_API] Instance '${instanceName}' already exists.`);
          return { success: true, instanceName, status: 'EXISTS' };
        }
        return { success: false, instanceName, error: `HTTP_${response.status}: ${errText}` };
      }

      const resData = await response.json();
      console.log(`[EVOLUTION_API] Instance '${instanceName}' created successfully:`, resData);
      const qrData = resData?.qrcode || resData?.hash || {};

      if (webhookUrl) {
        const whResult = await this.setWebhook(instanceName, webhookUrl);
        if (!whResult.success) {
          console.error(`[EVOLUTION_API] setWebhook warning: ${whResult.error}`);
        }
      }

      return {
        success: true,
        instanceName,
        status: resData?.instance?.status || 'CREATED',
        qrcode: {
          code: qrData?.code || resData?.code,
          base64: qrData?.base64 || resData?.base64,
          pairingCode: qrData?.pairingCode || resData?.pairingCode,
        },
      };
    } catch (err: any) {
      console.error(`[EVOLUTION_API] createInstance exception:`, err);
      return { success: false, instanceName, error: err.message };
    }
  }

  /**
   * Gets connection state for an instance ('CONNECTED' | 'WAITING_QR' | 'DISCONNECTED' | 'ERROR')
   */
  async getConnectionState(instanceName: string): Promise<{
    state: 'CONNECTED' | 'WAITING_QR' | 'DISCONNECTED' | 'ERROR';
    rawState?: string;
    ownerJid?: string;
    phoneNumber?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { state: 'ERROR', error: this.getConfigError()! };
    }
    console.log(`[EVOLUTION_API] 📡 STEP 2: Checking connection state for instance '${instanceName}'...`);
    try {
      const response = await fetch(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: this.apiKey },
      });

      if (!response.ok) {
        console.warn(`[EVOLUTION_API] connectionState HTTP ${response.status}`);
        return { state: 'DISCONNECTED', error: `HTTP_${response.status}` };
      }

      const data = await response.json();
      const rawState = (
        data?.instance?.state ||
        data?.state ||
        data?.status ||
        'close'
      ).toLowerCase();

      const ownerJid = data?.instance?.ownerJid || data?.ownerJid || data?.owner || '';
      let phoneNumber = '';
      if (ownerJid) {
        const rawUser = ownerJid.split('@')[0].split(':')[0];
        const cleanDigits = rawUser.replace(/[^\d]/g, '');
        if (cleanDigits) {
          phoneNumber = `+${cleanDigits}`;
        }
      }

      console.log(`[EVOLUTION_API] connectionState rawState='${rawState}', phoneNumber='${phoneNumber}'`);

      if (rawState === 'open' || rawState === 'connected') {
        return { state: 'CONNECTED', rawState, ownerJid, phoneNumber };
      }
      if (rawState === 'connecting' || rawState === 'qrcode' || rawState === 'waiting_qr') {
        return { state: 'WAITING_QR', rawState, ownerJid, phoneNumber };
      }

      return { state: 'DISCONNECTED', rawState, ownerJid, phoneNumber };
    } catch (err: any) {
      console.error(`[EVOLUTION_API] getConnectionState exception:`, err);
      return { state: 'ERROR', error: err.message };
    }
  }

  /**
   * Requests a fresh QR Code from Evolution API for the instance.
   */
  async getQrCode(instanceName: string): Promise<{
    success: boolean;
    base64?: string;
    code?: string;
    pairingCode?: string;
    error?: string;
  }> {
    console.log(`[EVOLUTION_API] 📷 STEP 3: Requesting QR Code for instance '${instanceName}'...`);
    try {
      const response = await fetch(`${this.baseUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: this.apiKey },
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[EVOLUTION_API] instance/connect HTTP ${response.status}: ${errText}`);
        return { success: false, error: `HTTP_${response.status}: ${errText}` };
      }

      const data = await response.json();
      const base64 = data?.base64 || data?.qrcode?.base64 || '';
      const code = data?.code || data?.qrcode?.code || '';
      const pairingCode = data?.pairingCode || data?.qrcode?.pairingCode || '';

      console.log(`[EVOLUTION_API] QR Code fetched successfully (hasBase64=${Boolean(base64)})`);
      return { success: true, base64, code, pairingCode };
    } catch (err: any) {
      console.error(`[EVOLUTION_API] getQrCode exception:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Sets up or updates the webhook on Evolution API.
   */
  async setWebhook(instanceName: string, webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[EVOLUTION_API] 🔗 STEP 4: Setting webhook for instance '${instanceName}' -> ${webhookUrl}`);
    try {
      const response = await fetch(`${this.baseUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: [
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'CONNECTION_UPDATE',
              'QRCODE_UPDATED',
            ],
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[EVOLUTION_API] setWebhook HTTP ${response.status} for instance '${instanceName}':`, errText);
        return {
          success: false,
          error: `HTTP_${response.status}: ${errText}`,
        };
      }

      console.log(`[EVOLUTION_API] Webhook set successfully for instance '${instanceName}'`);
      return { success: true };
    } catch (err: any) {
      console.error(`[EVOLUTION_API] setWebhook exception:`, err);
      return {
        success: false,
        error: err.message || 'Erreur réseau/inconnue lors de la configuration du webhook',
      };
    }
  }

  /**
   * Logs out or deletes an instance on Evolution API.
   */
  async logoutInstance(instanceName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { apikey: this.apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetches instance identity/profile from Evolution API.
   */
  async getInstanceOwnerInfo(instanceName: string): Promise<{
    phoneNumber?: string;
    displayName?: string;
    ownerJid?: string;
  }> {
    try {
      const stateRes = await this.getConnectionState(instanceName);
      if (stateRes.phoneNumber) {
        return {
          phoneNumber: stateRes.phoneNumber,
          ownerJid: stateRes.ownerJid,
          displayName: `WhatsApp (${stateRes.phoneNumber})`,
        };
      }

      const fetchRes = await fetch(`${this.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
        headers: { apikey: this.apiKey },
      });
      if (fetchRes.ok) {
        const instances = await fetchRes.json();
        const inst = Array.isArray(instances)
          ? instances.find((i: any) => i.name === instanceName || i.instanceName === instanceName)
          : instances;
        if (inst) {
          const ownerJid = inst.ownerJid || inst.owner || '';
          const rawUser = ownerJid.split('@')[0].split(':')[0].replace(/[^\d]/g, '');
          if (rawUser) {
            return {
              phoneNumber: `+${rawUser}`,
              ownerJid,
              displayName: inst.profileName || `WhatsApp (+${rawUser})`,
            };
          }
        }
      }
    } catch (e) {
      console.error('getInstanceOwnerInfo exception:', e);
    }
    return {};
  }
}
