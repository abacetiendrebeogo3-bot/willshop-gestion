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

  public isDemo(): boolean {
    const upper = this.baseUrl.toUpperCase();
    return upper === 'DEMO' || upper === 'MOCK' || upper === 'SIMULATION' || process.env.NEXT_PUBLIC_DEMO_WHATSAPP === 'true';
  }

  public isConfigured(): boolean {
    if (this.isDemo()) return true;
    const configured = Boolean(this.baseUrl && this.apiKey);
    if (!configured) {
      console.warn(`[EVOLUTION_API_CONFIG] Unconfigured: baseUrl="${this.baseUrl}", apiKeyPresent=${Boolean(this.apiKey)}`);
    }
    return configured;
  }

  public getConfigError(): string | null {
    if (this.isDemo()) return null;
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

  private formatNetworkError(err: any): string {
    const msg = err?.message || '';
    const causeCode = err?.cause?.code || err?.code || '';
    if (causeCode === 'ENOTFOUND' || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      return `Serveur Evolution inaccessible (${this.baseUrl}) : nom d'hôte ou domaine introuvable (DNS ENOTFOUND). Vérifiez l'adresse ou activez la passerelle Démo.`;
    }
    if (causeCode === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
      return `Connexion refusée par le serveur Evolution (${this.baseUrl}) : aucun service actif sur ce port.`;
    }
    if (causeCode === 'ETIMEDOUT' || msg.includes('timeout') || msg.includes('timed out')) {
      return `Délai d'attente dépassé pour le serveur Evolution (${this.baseUrl}). Le serveur met trop de temps à répondre.`;
    }
    if (msg.includes('fetch failed')) {
      return `Impossible d'établir la connexion avec Evolution API (${this.baseUrl}) : serveur hors ligne ou inaccessible.`;
    }
    return msg || 'Erreur réseau inconnue avec Evolution API';
  }

  public getDemoQrSvg(): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
      <rect width="240" height="240" fill="#ffffff" rx="16"/>
      <rect x="20" y="20" width="50" height="50" fill="#1F1917" rx="6"/>
      <rect x="28" y="28" width="34" height="34" fill="#ffffff" rx="4"/>
      <rect x="36" y="36" width="18" height="18" fill="#800020" rx="2"/>
      <rect x="170" y="20" width="50" height="50" fill="#1F1917" rx="6"/>
      <rect x="178" y="28" width="34" height="34" fill="#ffffff" rx="4"/>
      <rect x="186" y="36" width="18" height="18" fill="#800020" rx="2"/>
      <rect x="20" y="170" width="50" height="50" fill="#1F1917" rx="6"/>
      <rect x="28" y="178" width="34" height="34" fill="#ffffff" rx="4"/>
      <rect x="36" y="186" width="18" height="18" fill="#800020" rx="2"/>
      <!-- QR pattern modules -->
      <rect x="80" y="25" width="10" height="10" fill="#1F1917"/>
      <rect x="100" y="25" width="20" height="10" fill="#1F1917"/>
      <rect x="130" y="25" width="10" height="10" fill="#1F1917"/>
      <rect x="150" y="25" width="10" height="10" fill="#1F1917"/>
      <rect x="80" y="45" width="30" height="10" fill="#1F1917"/>
      <rect x="120" y="45" width="20" height="10" fill="#800020"/>
      <rect x="150" y="45" width="10" height="10" fill="#1F1917"/>
      <rect x="80" y="80" width="15" height="15" fill="#1F1917"/>
      <rect x="105" y="80" width="30" height="15" fill="#1F1917"/>
      <rect x="145" y="80" width="15" height="15" fill="#800020"/>
      <rect x="170" y="80" width="15" height="15" fill="#1F1917"/>
      <rect x="195" y="80" width="25" height="15" fill="#1F1917"/>
      <rect x="25" y="80" width="15" height="15" fill="#1F1917"/>
      <rect x="50" y="80" width="20" height="15" fill="#1F1917"/>
      <rect x="25" y="105" width="35" height="15" fill="#1F1917"/>
      <rect x="70" y="105" width="25" height="15" fill="#800020"/>
      <rect x="105" y="105" width="30" height="30" fill="#25D366" rx="8"/>
      <!-- WhatsApp Icon in center -->
      <path d="M120 112 C115 112 111 116 111 121 C111 123 112 125 113 126 L112 129 L115 128 C116 129 118 130 120 130 C125 130 129 126 129 121 C129 116 125 112 120 112 Z" fill="#ffffff"/>
      <rect x="145" y="105" width="25" height="15" fill="#1F1917"/>
      <rect x="180" y="105" width="40" height="15" fill="#1F1917"/>
      <rect x="25" y="130" width="20" height="15" fill="#1F1917"/>
      <rect x="55" y="130" width="15" height="15" fill="#1F1917"/>
      <rect x="80" y="145" width="40" height="15" fill="#1F1917"/>
      <rect x="130" y="145" width="25" height="15" fill="#800020"/>
      <rect x="165" y="145" width="20" height="15" fill="#1F1917"/>
      <rect x="195" y="145" width="25" height="15" fill="#1F1917"/>
      <rect x="80" y="170" width="20" height="15" fill="#1F1917"/>
      <rect x="110" y="170" width="30" height="15" fill="#1F1917"/>
      <rect x="150" y="170" width="20" height="15" fill="#800020"/>
      <rect x="180" y="170" width="40" height="15" fill="#1F1917"/>
      <rect x="80" y="195" width="35" height="25" fill="#1F1917"/>
      <rect x="125" y="195" width="25" height="25" fill="#1F1917"/>
      <rect x="160" y="195" width="30" height="25" fill="#1F1917"/>
      <rect x="200" y="195" width="20" height="25" fill="#800020"/>
    </svg>`;
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }

  async sendTextMessage(
    providerPhoneNumberId: string,
    dto: SendTextMessageDTO
  ): Promise<WhatsAppSendResult> {
    const cleanTo = dto.toPhoneNumber.replace(/[^\d]/g, '');
    const instance = providerPhoneNumberId;

    if (this.isDemo()) {
      console.log(`[DEMO_WHATSAPP] Outbound message sent to +${cleanTo}: "${dto.messageText}"`);
      return {
        externalMessageId: `DEMO-MSG-${Date.now()}`,
        status: 'SENT',
      };
    }

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
          errorCode: `HTTP_${response.status}: ${errorText.slice(0, 100)}`,
        };
      }

      const resData = await response.json();
      const externalMessageId = resData?.key?.id || resData?.id || `EVO-SENT-${Date.now()}`;

      return {
        externalMessageId,
        status: 'SENT',
      };
    } catch (err: any) {
      const formatted = this.formatNetworkError(err);
      console.error('Evolution API sendTextMessage exception:', formatted);
      return {
        externalMessageId: `EVO-ERR-${Date.now()}`,
        status: 'FAILED',
        errorCode: formatted,
      };
    }
  }

  async sendMediaMessage(
    providerPhoneNumberId: string,
    dto: SendMediaMessageDTO
  ): Promise<WhatsAppSendResult> {
    const cleanTo = dto.toPhoneNumber.replace(/[^\d]/g, '');
    const instance = providerPhoneNumberId;

    if (this.isDemo()) {
      console.log(`[DEMO_WHATSAPP] Outbound media sent to +${cleanTo}: ${dto.mediaUrl}`);
      return {
        externalMessageId: `DEMO-MEDIA-${Date.now()}`,
        status: 'SENT',
      };
    }

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
        const errorText = await response.text().catch(() => '');
        return {
          externalMessageId: `EVO-ERR-${Date.now()}`,
          status: 'FAILED',
          errorCode: `HTTP_${response.status}: ${errorText.slice(0, 100)}`,
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
        errorCode: this.formatNetworkError(err),
      };
    }
  }

  async markMessageAsRead(
    providerPhoneNumberId: string,
    externalMessageId: string
  ): Promise<boolean> {
    if (this.isDemo()) return true;
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
    if (this.isDemo()) return true;
    const expectedKey = (secret || this.apiKey || '').trim();
    if (!signature || !signature.trim()) return true;
    if (!expectedKey) return true;
    return signature === expectedKey || signature.includes(expectedKey) || expectedKey.includes(signature);
  }

  /**
   * Creates or fetches an instance on Evolution API v2 or simulation.
   */
  async createInstance(instanceName: string, webhookUrl?: string): Promise<{
    success: boolean;
    instanceName: string;
    status?: string;
    qrcode?: { code?: string; base64?: string; pairingCode?: string };
    error?: string;
    isDemo?: boolean;
  }> {
    if (this.isDemo()) {
      console.log(`[DEMO_WHATSAPP] 🚀 Created simulated instance '${instanceName}'`);
      return {
        success: true,
        instanceName,
        status: 'CONNECTED',
        isDemo: true,
        qrcode: {
          code: `DEMO-${instanceName}`,
          base64: this.getDemoQrSvg(),
          pairingCode: 'DEMO-1234',
        },
      };
    }

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
        return { success: false, instanceName, error: `HTTP_${response.status}: ${errText.slice(0, 150)}` };
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
      const formatted = this.formatNetworkError(err);
      console.error(`[EVOLUTION_API] createInstance exception:`, formatted);
      return { success: false, instanceName, error: formatted };
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
    isDemo?: boolean;
  }> {
    if (this.isDemo()) {
      return {
        state: 'CONNECTED',
        rawState: 'open',
        phoneNumber: '+22655002796',
        ownerJid: '22655002796@s.whatsapp.net',
        isDemo: true,
      };
    }

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
      const formatted = this.formatNetworkError(err);
      console.error(`[EVOLUTION_API] getConnectionState exception:`, formatted);
      return { state: 'ERROR', error: formatted };
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
    if (this.isDemo()) {
      return {
        success: true,
        base64: this.getDemoQrSvg(),
        code: `DEMO-${instanceName}`,
        pairingCode: 'DEMO-1234',
      };
    }

    console.log(`[EVOLUTION_API] 📷 STEP 3: Requesting QR Code for instance '${instanceName}'...`);
    try {
      const response = await fetch(`${this.baseUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: this.apiKey },
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[EVOLUTION_API] instance/connect HTTP ${response.status}: ${errText}`);
        return { success: false, error: `HTTP_${response.status}: ${errText.slice(0, 100)}` };
      }

      const data = await response.json();
      const base64 = data?.base64 || data?.qrcode?.base64 || '';
      const code = data?.code || data?.qrcode?.code || '';
      const pairingCode = data?.pairingCode || data?.qrcode?.pairingCode || '';

      console.log(`[EVOLUTION_API] QR Code fetched successfully (hasBase64=${Boolean(base64)})`);
      return { success: true, base64, code, pairingCode };
    } catch (err: any) {
      const formatted = this.formatNetworkError(err);
      console.error(`[EVOLUTION_API] getQrCode exception:`, formatted);
      return { success: false, error: formatted };
    }
  }

  /**
   * Sets up or updates the webhook on Evolution API.
   */
  async setWebhook(instanceName: string, webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    if (this.isDemo()) {
      return { success: true };
    }

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
          error: `HTTP_${response.status}: ${errText.slice(0, 100)}`,
        };
      }

      console.log(`[EVOLUTION_API] Webhook set successfully for instance '${instanceName}'`);
      return { success: true };
    } catch (err: any) {
      const formatted = this.formatNetworkError(err);
      console.error(`[EVOLUTION_API] setWebhook exception:`, formatted);
      return {
        success: false,
        error: formatted,
      };
    }
  }

  /**
   * Logs out or deletes an instance on Evolution API.
   */
  async logoutInstance(instanceName: string): Promise<boolean> {
    if (this.isDemo()) {
      console.log(`[DEMO_WHATSAPP] Logged out simulated instance '${instanceName}'`);
      return true;
    }
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
    if (this.isDemo()) {
      return {
        phoneNumber: '+22655002796',
        ownerJid: '22655002796@s.whatsapp.net',
        displayName: 'WILLShop Démo (+226 55 00 27 96)',
      };
    }

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
