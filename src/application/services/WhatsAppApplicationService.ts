/**
 * WILLShop OS — WhatsApp Application Orchestrator Service
 * Application Layer.
 * Manages event normalization, org resolution, idempotency, conversation modes (AI_ACTIVE vs HUMAN_ACTIVE),
 * audio transcription, smartphone sync (fromMe), AI trigger, and provider response delivery.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { InboundWhatsAppEvent } from '../../domain/entities/WhatsAppEventEntities';
import { IWhatsAppProvider } from '../../domain/interfaces/IWhatsAppProvider';
import { SalesAgentService, SalesAgentContextService } from './SalesAgentService';
import { AnthropicAIGateway } from '../../infrastructure/ai/AnthropicAIGateway';
import { AIToolsRegistry } from './AIToolsRegistry';
import { SupabaseProductRepository } from '../../infrastructure/repositories/SupabaseDataCoreRepositories';
import { InMemoryOrderRepository } from '../../infrastructure/repositories/InMemoryDataCoreRepositories';
import { CreateOrderService } from './OrderStockApplicationServices';
import { MarketingAttributionService } from './MarketingAttributionService';
import { OrderExecutionService } from './OrderExecutionService';
import { AIGlobalGuardService } from './AIGlobalGuardService';


export class WhatsAppApplicationService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly providerAdapter: IWhatsAppProvider
  ) {}

  /**
   * Helper to check if buffer has valid audio header magic bytes.
   */
  private isValidAudioBuffer(buf: Buffer): boolean {
    if (!buf || buf.length < 30) return false;
    // Check OGG header ("OggS" = 0x4f 0x67 0x67 0x53)
    if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return true;
    // Check MP3 ID3 header ("ID3")
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
    // Check MP3 sync word (0xFF 0xFB, 0xFF 0xF3, 0xFF 0xF2)
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
    // Check WAV ("RIFF")
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
    // Check AAC / M4A ("ftyp")
    if (buf.length > 12 && buf.toString('ascii', 4, 8) === 'ftyp') return true;

    // Reject raw encrypted WhatsApp .enc binary buffers or HTML error responses
    return false;
  }

  /**
   * Downloads or decodes the audio buffer from base64, Evolution API base64 endpoint, or mediaUrl with retries.
   */
  private async fetchAudioBufferWithRetry(event: InboundWhatsAppEvent): Promise<Buffer | null> {
    // 1. Direct base64 from normalized event
    if (event.base64) {
      try {
        const cleanB64 = event.base64.replace(/^data:audio\/[a-z0-9]+;base64,/i, '').trim();
        if (cleanB64.length > 20) {
          const buf = Buffer.from(cleanB64, 'base64');
          if (this.isValidAudioBuffer(buf)) return buf;
        }
      } catch (b64Err) {
        console.warn('[Audio base64 decode warning]', b64Err);
      }
    }

    // 2. Fetch decrypted base64 via Evolution API endpoint using full original key
    const evoUrl = process.env.EVOLUTION_API_URL ? process.env.EVOLUTION_API_URL.replace(/\/+$/, '') : '';
    const evoKey = process.env.EVOLUTION_API_KEY || '';
    const instanceName = event.providerIdentity || 'ws_org_27f3fcc3402b';

    if (evoUrl && evoKey && event.externalMessageId) {
      const rawDigits = event.senderPhone ? event.senderPhone.replace(/[^\d]/g, '') : '';
      const targetRemoteJid = event.messageKey?.remoteJid || (rawDigits ? `${rawDigits}@s.whatsapp.net` : '');

      const fullMessageKey = {
        id: event.messageKey?.id || event.externalMessageId,
        remoteJid: targetRemoteJid,
        fromMe: event.messageKey?.fromMe !== undefined ? event.messageKey.fromMe : event.fromMe,
        ...(event.messageKey || {}),
      };

      const endpointsToTry = [
        `/chat/getBase64FromMediaMessage/${instanceName}`,
        `/message/downloadMedia/${instanceName}`,
      ];

      for (const ep of endpointsToTry) {
        try {
          const bodyPayload = {
            message: {
              key: fullMessageKey,
            },
            convertToMp4: false,
          };

          const res = await fetch(`${evoUrl}${ep}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evoKey,
            },
            body: JSON.stringify(bodyPayload),
          });

          if (res.ok) {
            const data = await res.json();
            const b64 = data.base64 || data.mediaUrl || data.data?.base64;
            if (typeof b64 === 'string' && b64.length > 50) {
              const cleanB64 = b64.replace(/^data:audio\/[a-z0-9]+;base64,/i, '').trim();
              const buf = Buffer.from(cleanB64, 'base64');
              if (this.isValidAudioBuffer(buf)) return buf;
            }
          }
        } catch (evoFetchErr) {
          console.warn(`[Evolution Media API Fetch Warning ${ep}]`, evoFetchErr);
        }
      }
    }

    // 3. Fallback: Direct mediaUrl fetch (only attach apikey header if fetching directly from Evolution API host)
    if (event.mediaUrl) {
      const headers: Record<string, string> = {};
      const isEvolutionHost = evoUrl && event.mediaUrl.toLowerCase().includes(evoUrl.toLowerCase());
      if (isEvolutionHost && evoKey) {
        headers['apikey'] = evoKey;
      }

      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const res = await fetch(event.mediaUrl, { headers });
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            if (this.isValidAudioBuffer(buf)) return buf;
          }
        } catch (netErr) {
          console.warn(`[Audio fetch retry ${attempt}/${maxRetries}]`, netErr);
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 300));
        }
      }
    }

    return null;
  }

  private detectImageMimeType(buf: Buffer): string {
    if (!buf || buf.length < 4) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
    if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return 'image/jpeg';
  }

  private isValidImageBuffer(buf: Buffer): boolean {
    if (!buf || buf.length < 100) return false;
    const sample = buf.subarray(0, 50).toString('utf-8').toLowerCase();
    if (sample.includes('<!doctype') || sample.includes('<html')) return false;
    return true;
  }

  public async fetchImageBufferWithRetry(event: InboundWhatsAppEvent): Promise<Buffer | null> {
    if (event.base64) {
      try {
        const cleanB64 = event.base64.replace(/^data:image\/[a-z0-9]+;base64,/i, '').trim();
        if (cleanB64.length > 50) {
          const buf = Buffer.from(cleanB64, 'base64');
          if (this.isValidImageBuffer(buf)) return buf;
        }
      } catch (b64Err) {
        console.warn('[Image base64 decode warning]', b64Err);
      }
    }

    const evoUrl = process.env.EVOLUTION_API_URL ? process.env.EVOLUTION_API_URL.replace(/\/+$/, '') : '';
    const evoKey = process.env.EVOLUTION_API_KEY || '';
    const instanceName = event.providerIdentity || 'ws_org_27f3fcc3402b';

    if (evoUrl && evoKey && event.externalMessageId) {
      const rawDigits = event.senderPhone ? event.senderPhone.replace(/[^\d]/g, '') : '';
      const targetRemoteJid = event.messageKey?.remoteJid || (rawDigits ? `${rawDigits}@s.whatsapp.net` : '');

      const fullMessageKey = {
        id: event.messageKey?.id || event.externalMessageId,
        remoteJid: targetRemoteJid,
        fromMe: event.messageKey?.fromMe !== undefined ? event.messageKey.fromMe : event.fromMe,
        ...(event.messageKey || {}),
      };

      const endpointsToTry = [
        `/chat/getBase64FromMediaMessage/${instanceName}`,
        `/message/downloadMedia/${instanceName}`,
      ];

      for (const ep of endpointsToTry) {
        try {
          const bodyPayload = {
            message: {
              key: fullMessageKey,
            },
            convertToMp4: false,
          };

          const res = await fetch(`${evoUrl}${ep}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evoKey,
            },
            body: JSON.stringify(bodyPayload),
          });

          if (res.ok) {
            const data = await res.json();
            const b64 = data.base64 || data.mediaUrl || data.data?.base64;
            if (typeof b64 === 'string' && b64.length > 50) {
              const cleanB64 = b64.replace(/^data:image\/[a-z0-9]+;base64,/i, '').trim();
              const buf = Buffer.from(cleanB64, 'base64');
              if (this.isValidImageBuffer(buf)) return buf;
            }
          }
        } catch (evoFetchErr) {
          console.warn(`[Evolution Image API Fetch Warning ${ep}]`, evoFetchErr);
        }
      }
    }

    if (event.mediaUrl) {
      const headers: Record<string, string> = {};
      const isEvolutionHost = evoUrl && event.mediaUrl.toLowerCase().includes(evoUrl.toLowerCase());
      if (isEvolutionHost && evoKey) {
        headers['apikey'] = evoKey;
      }

      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const res = await fetch(event.mediaUrl, { headers });
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            if (this.isValidImageBuffer(buf)) return buf;
          }
        } catch (netErr) {
          console.warn(`[Image fetch retry ${attempt}/${maxRetries}]`, netErr);
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 300));
        }
      }
    }

    return null;
  }

  /**
   * Transcribes an audio buffer server-side strictly via OpenAI Whisper (or Groq Whisper).
   */
  private async transcribeAudioBuffer(
    audioBuffer: Buffer,
    fileName: string
  ): Promise<{ text: string | null; errorReason?: string }> {
    const openaiKey = process.env.OPENAI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    const apiKey = openaiKey || groqKey;

    if (!apiKey) {
      console.warn('[ASR Transcription Error] Neither OPENAI_API_KEY nor GROQ_API_KEY is configured in environment.');
      return { text: null, errorReason: 'MISSING_OPENAI_API_KEY' };
    }

    const endpoint = openaiKey
      ? 'https://api.openai.com/v1/audio/transcriptions'
      : 'https://api.groq.com/openai/v1/audio/transcriptions';
    const model = openaiKey ? 'whisper-1' : 'whisper-large-v3';

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const formData = new FormData();
        const uint8 = new Uint8Array(audioBuffer);
        const blob = new Blob([uint8], { type: 'audio/ogg' });
        formData.append('file', blob, fileName);
        formData.append('model', model);
        formData.append('language', 'fr');

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          return { text: data.text ? data.text.trim() : null };
        }
        console.warn(`[Whisper API Error attempt ${attempt}] Status ${res.status}`);
      } catch (err) {
        console.warn(`[Transcription Exception attempt ${attempt}]`, err);
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 300));
      }
    }

    return { text: null, errorReason: 'WHISPER_API_HTTP_ERROR' };
  }

  /**
   * Validates if a transcription text is meaningful, exploitable, and supported.
   */
  private validateTranscriptionExploitability(
    text: string | null,
    technicalError?: string
  ): {
    isExploitable: boolean;
    status: 'COMPLETED' | 'INCOMPREHENSIBLE' | 'UNSUPPORTED_LANGUAGE' | 'TRANSCRIPTION_TECHNICAL_ERROR';
    cleanedText: string;
  } {
    if (technicalError) {
      return { isExploitable: false, status: 'TRANSCRIPTION_TECHNICAL_ERROR', cleanedText: '' };
    }

    if (!text || typeof text !== 'string') {
      return { isExploitable: false, status: 'TRANSCRIPTION_TECHNICAL_ERROR', cleanedText: '' };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return { isExploitable: false, status: 'INCOMPREHENSIBLE', cleanedText: '' };
    }

    // Remove punctuation/filler noise to evaluate core length
    const cleaned = trimmed.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').trim();

    if (cleaned.length < 3) {
      return { isExploitable: false, status: 'INCOMPREHENSIBLE', cleanedText: trimmed };
    }

    // Common filler words or unusable sounds
    const noiseOnly = ['euh', 'ah', 'hum', 'hein', 'oh', 'voilà'];
    if (cleaned.length < 4 && noiseOnly.includes(cleaned.toLowerCase())) {
      return { isExploitable: false, status: 'INCOMPREHENSIBLE', cleanedText: trimmed };
    }

    return { isExploitable: true, status: 'COMPLETED', cleanedText: trimmed };
  }

  /**
   * Processes an incoming normalized WhatsApp event.
   */
  async processInboundEvent(event: InboundWhatsAppEvent): Promise<{
    status: 'SUCCESS' | 'IGNORED' | 'ERROR';
    message: string;
    organizationId?: string;
    conversationId?: string;
  }> {
    // 1. Strict Organization Resolution
    const providerIdentity = event.providerIdentity ? event.providerIdentity.trim() : '';
    if (!providerIdentity) {
      console.error('[WEBHOOK_REJECTED] providerIdentity missing from inbound event');
      return {
        status: 'ERROR',
        message: 'REJETÉ: providerIdentity absent de l événement entrant.',
      };
    }

    const { data: numRow } = await this.supabase
      .from('whatsapp_numbers')
      .select('organization_id, id, status')
      .or(`provider_identity.eq.${providerIdentity},provider_phone_number_id.eq.${providerIdentity},phone_number.eq.${providerIdentity}`)
      .eq('status', 'ACTIVE')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!numRow || !numRow.organization_id) {
      console.error(`[WEBHOOK_REJECTED] Strict organization lookup failed for providerIdentity '${providerIdentity}'`);
      return {
        status: 'ERROR',
        message: `REJETÉ: Aucune organisation active enregistrée pour providerIdentity '${providerIdentity}'`,
      };
    }

    const targetOrgId = numRow.organization_id;
    const whatsappNumberId = numRow.id;

    // 2. Idempotency Check on external_message_id
    if (event.externalMessageId) {
      const { data: existingMsg } = await this.supabase
        .from('messages')
        .select('id')
        .eq('organization_id', targetOrgId)
        .eq('external_message_id', event.externalMessageId)
        .limit(1)
        .maybeSingle();

      if (existingMsg) {
        return {
          status: 'IGNORED',
          message: `Duplicate external message ID '${event.externalMessageId}' ignored`,
          organizationId: targetOrgId,
        };
      }
    }

    // 3. Canonical Phone & Customer Resolution
    const normalizedPhone = event.senderPhone.startsWith('+')
      ? event.senderPhone
      : `+${event.senderPhone.replace(/[^\d]/g, '')}`;
    const rawDigits = event.senderPhone.replace(/[^\d]/g, '');

    // Geographic guard: only create customers for Burkina Faso (+226) numbers.
    const ALLOWED_COUNTRY_PREFIXES = ['+226', '226'];
    const isAllowedCountry = ALLOWED_COUNTRY_PREFIXES.some(
      (prefix) => normalizedPhone.startsWith(prefix) || rawDigits.startsWith(prefix.replace('+', ''))
    );

    if (!rawDigits || rawDigits.length < 8 || !isAllowedCountry) {
      console.info(`[WEBHOOK_GEO_GUARD] Invalid or foreign number ${normalizedPhone} ignored. No conversation created.`);
      return {
        status: 'IGNORED',
        message: 'Foreign or invalid number ignored to avoid CRM clutter',
        organizationId: targetOrgId,
      };
    }

    let customerId = '';
    const { data: existingCusts } = await this.supabase
      .from('customers')
      .select('id, phone')
      .eq('organization_id', targetOrgId)
      .or(`phone.eq.${normalizedPhone},phone.eq.+${rawDigits},phone.eq.${rawDigits}`)
      .order('created_at', { ascending: true })
      .limit(1);

    const existingCust = existingCusts?.[0];

    if (existingCust) {
      customerId = existingCust.id;
    } else {
      // Only create a CRM customer for local (+226) numbers (which is guaranteed here)
      try {
        const { data: newCust } = await this.supabase
          .from('customers')
          .insert({
            organization_id: targetOrgId,
            first_name: event.senderName || `Client ${normalizedPhone.slice(-4)}`,
            last_name: 'WhatsApp',
            phone: normalizedPhone,
            whatsapp_phone: normalizedPhone,
            status: 'ACTIVE',
            source: 'WHATSAPP_AUTO',
          })
          .select()
          .single();

        if (newCust) customerId = newCust.id;
      } catch (custErr: any) {
        const { data: retryCust } = await this.supabase
          .from('customers')
          .select('id')
          .eq('organization_id', targetOrgId)
          .or(`phone.eq.${normalizedPhone},phone.eq.+${rawDigits},phone.eq.${rawDigits}`)
          .limit(1)
          .maybeSingle();

        if (retryCust) customerId = retryCust.id;
      }
    }

    // 4. Lookup or Create Single Active Conversation per Customer
    let conversationId = '';
    let conversationMode: 'AI_ACTIVE' | 'HUMAN_ACTIVE' | 'ESCALATED' | 'PAUSED' = 'AI_ACTIVE';

    const { data: existingConvs } = await this.supabase
      .from('conversations')
      .select('id, conversation_mode, assigned_agent, status, metadata, unread_count')
      .eq('organization_id', targetOrgId)
      .eq('customer_id', customerId)
      .neq('status', 'ARCHIVED')
      .order('created_at', { ascending: false })
      .limit(1);

    const existingConv = existingConvs?.[0];

    if (existingConv) {
      conversationId = existingConv.id;
      conversationMode = (existingConv.conversation_mode as any) || 'AI_ACTIVE';

      const nowIso = new Date().toISOString();
      const updatedMeta = {
        ...(existingConv.metadata || {}),
        ...(event.fromMe ? { last_human_activity_at: nowIso, last_commercial_message_at: nowIso } : { last_customer_message_at: nowIso }),
      };

      const newUnreadCount = event.fromMe ? 0 : (existingConv.unread_count || 0) + 1;

      await this.supabase
        .from('conversations')
        .update({ last_message_at: nowIso, status: 'OPEN', metadata: updatedMeta, unread_count: newUnreadCount })
        .eq('id', conversationId);
    } else {
      const initialMode = event.fromMe ? 'HUMAN_ACTIVE' : 'AI_ACTIVE';
      try {
        const nowIso = new Date().toISOString();
        const { data: newConv } = await this.supabase
          .from('conversations')
          .insert({
            organization_id: targetOrgId,
            customer_id: customerId || null,
            whatsapp_number_id: whatsappNumberId,
            channel: 'WHATSAPP',
            status: 'OPEN',
            conversation_mode: initialMode,
            assigned_agent: event.fromMe ? 'HUMAN' : 'SALES_AI',
            last_message_at: nowIso,
            unread_count: event.fromMe ? 0 : 1,
            metadata: event.fromMe ? { last_human_activity_at: nowIso, last_commercial_message_at: nowIso } : { last_customer_message_at: nowIso },
          })
          .select()
          .single();

        if (newConv) {
          conversationId = newConv.id;
          conversationMode = initialMode;
        }
      } catch (convErr: any) {
        const { data: retryConv } = await this.supabase
          .from('conversations')
          .select('id, conversation_mode')
          .eq('organization_id', targetOrgId)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (retryConv) {
          conversationId = retryConv.id;
          conversationMode = (retryConv.conversation_mode as any) || 'AI_ACTIVE';
        }
      }
    }

    // 5. Handle Smartphone Sync (fromMe === true)
    if (event.fromMe) {
      const { error: insertErr } = await this.supabase.from('messages').insert({
        organization_id: targetOrgId,
        conversation_id: conversationId,
        customer_id: customerId || null,
        direction: 'OUTBOUND',
        sender_type: 'HUMAN',
        sender_id: event.senderPhone,
        message_type: event.messageType,
        content: event.textBody || '[Media]',
        external_message_id: event.externalMessageId,
        status: 'SENT',
      });

      if (insertErr && (insertErr.code === '23505' || insertErr.message.includes('unique'))) {
        return {
          status: 'IGNORED',
          message: 'Duplicate smartphone message ignored.',
          organizationId: targetOrgId,
          conversationId,
        };
      }

      const nowIso = new Date().toISOString();
      await this.supabase
        .from('conversations')
        .update({
          assigned_agent: 'HUMAN',
          last_message_at: nowIso,
        })
        .eq('id', conversationId);

      return {
        status: 'SUCCESS',
        message: 'Synced smartphone message (fromMe). Commercial activity recorded, followups recalculated.',
        organizationId: targetOrgId,
        conversationId,
      };
    }


    // 5b. Check Idempotency for ALL incoming messages before processing
    if (event.externalMessageId) {
      const { data: existingMsg } = await this.supabase
        .from('messages')
        .select('id')
        .eq('organization_id', targetOrgId)
        .eq('external_message_id', event.externalMessageId)
        .limit(1)
        .maybeSingle();

      if (existingMsg) {
        return {
          status: 'IGNORED',
          message: `Duplicate external_message_id '${event.externalMessageId}' ignored.`,
          organizationId: targetOrgId,
          conversationId,
        };
      }
    }

    // 6. Handle AUDIO Messages (WhatsApp Voice Notes)
    if (event.messageType === 'AUDIO') {
      const audioBuffer = await this.fetchAudioBufferWithRetry(event);
      let transcribedText: string | null = null;
      let technicalError: string | undefined;
      let storagePublicUrl: string | null = event.mediaUrl || null;

      if (audioBuffer) {
        const fileName = `audio_${Date.now()}.ogg`;
        const storagePath = `${targetOrgId}/${fileName}`;
        try {
          const { error: upErr } = await this.supabase.storage
            .from('whatsapp-media')
            .upload(storagePath, audioBuffer, { contentType: 'audio/ogg', upsert: true });

          if (!upErr) {
            const { data: urlData } = this.supabase.storage
              .from('whatsapp-media')
              .getPublicUrl(storagePath);
            if (urlData?.publicUrl) {
              storagePublicUrl = urlData.publicUrl;
            }
          }
        } catch (stErr) {
          console.warn('[Storage upload warning for audio]', stErr);
        }

        const transRes = await this.transcribeAudioBuffer(audioBuffer, fileName);
        transcribedText = transRes.text;
        if (transRes.errorReason) technicalError = transRes.errorReason;
      } else {
        technicalError = 'MEDIA_DOWNLOAD_FAILED';
      }

      const evalResult = this.validateTranscriptionExploitability(transcribedText, technicalError);

      if (!evalResult.isExploitable) {
        // RÈGLE ABSOLUE — VOCAL NON COMPRIS = SILENCE
        // Record internal message with INCOMPREHENSIBLE status
        await this.supabase.from('messages').insert({
          organization_id: targetOrgId,
          conversation_id: conversationId,
          customer_id: customerId || null,
          direction: 'INBOUND',
          sender_type: 'CUSTOMER',
          sender_id: event.senderPhone,
          message_type: 'AUDIO',
          content: '[Message vocal non transcrit / inexploitable]',
          media_url: storagePublicUrl,
          external_message_id: event.externalMessageId,
          status: 'RECEIVED',
          metadata: {
            transcription_status: evalResult.status,
            raw_transcription: transcribedText || null,
          },
        });

        // STRICT SILENCE RULE: 0 OUTBOUND MESSAGES SENT, 0 HUMAN HANDOFF CREATED, 0 ANTHROPIC CALLS
        return {
          status: 'SUCCESS',
          message: 'Message vocal inexploitable enregistré en interne. Règle de silence appliquée (0 réponse client, 0 escalade).',
          organizationId: targetOrgId,
          conversationId,
        };
      }

      // Valid & Exploitable Transcription!
      const validText = evalResult.cleanedText;

      // Fetch org settings to check for custom handoff keywords
      const { data: orgData } = await this.supabase
        .from('organizations')
        .select('settings')
        .eq('id', targetOrgId)
        .single();

      const aiAgentConfig = orgData?.settings?.ai_agent_config || {};
      const customKeywords = Array.isArray(aiAgentConfig.handoff_keywords)
        ? aiAgentConfig.handoff_keywords
        : ['humain', 'agent', 'remboursement', 'reclamation', 'conseiller'];

      const isExplicitHumanDemand = SalesAgentService.shouldTriggerHandoff(validText, customKeywords);

      if (isExplicitHumanDemand) {
        // EXCEPTION : DEMANDE EXPLICITE D'HUMAIN ENREGISTRÉE DANS LA TRANSCRIPTION
        await this.supabase.from('messages').insert({
          organization_id: targetOrgId,
          conversation_id: conversationId,
          customer_id: customerId || null,
          direction: 'INBOUND',
          sender_type: 'CUSTOMER',
          sender_id: event.senderPhone,
          message_type: 'AUDIO',
          content: validText,
          media_url: storagePublicUrl,
          external_message_id: event.externalMessageId,
          status: 'RECEIVED',
          metadata: {
            transcription_status: 'COMPLETED',
            transcription: validText,
            explicit_human_demand: true,
          },
        });

        await this.supabase.from('human_handoffs').insert({
          organization_id: targetOrgId,
          conversation_id: conversationId,
          reason: 'Demande explicite de conseiller humain dans message vocal',
          status: 'PENDING',
        });

        await this.supabase
          .from('conversations')
          .update({ conversation_mode: 'ESCALATED', assigned_agent: 'HUMAN' })
          .eq('id', conversationId);

        return {
          status: 'SUCCESS',
          message: 'Demande explicite de conseiller humain détectée dans le vocal. Transféré vers un humain.',
          organizationId: targetOrgId,
          conversationId,
        };
      }

      // Normal Commercial Intent
      event.textBody = validText;
      await this.supabase.from('messages').insert({
        organization_id: targetOrgId,
        conversation_id: conversationId,
        customer_id: customerId || null,
        direction: 'INBOUND',
        sender_type: 'CUSTOMER',
        sender_id: event.senderPhone,
        message_type: 'AUDIO',
        content: validText,
        media_url: storagePublicUrl,
        external_message_id: event.externalMessageId,
        status: 'RECEIVED',
        metadata: {
          transcription_status: 'COMPLETED',
          transcription: validText,
        },
      });
    } else {
      // Standard Inbound Customer Message (TEXT / IMAGE / etc.)
      const { error: msgErr } = await this.supabase.from('messages').insert({
        organization_id: targetOrgId,
        conversation_id: conversationId,
        customer_id: customerId || null,
        direction: 'INBOUND',
        sender_type: 'CUSTOMER',
        sender_id: event.senderPhone,
        message_type: event.messageType,
        content: event.textBody || '[Media]',
        media_url: event.mediaUrl || null,
        external_message_id: event.externalMessageId,
        status: 'RECEIVED',
      });

      if (msgErr && (msgErr.code === '23505' || msgErr.message.includes('unique'))) {
        return {
          status: 'IGNORED',
          message: `Duplicate external_message_id '${event.externalMessageId}' ignored.`,
          organizationId: targetOrgId,
          conversationId,
        };
      }
    }

    // 7. Server-Side Global AI Kill Switch Guard (AIGlobalGuardService SSOT)
    const aiGuardResult = await AIGlobalGuardService.checkAIEnabled(this.supabase, targetOrgId);
    if (!aiGuardResult.isAIEnabled) {
      try {
        await this.supabase.from('ai_actions').insert({
          organization_id: targetOrgId,
          action_type: 'AI_RESPONSE',
          permission_level: 'RED',
          status: 'BLOCKED',
          metadata: {
            reason: aiGuardResult.blockedReason || 'GLOBAL_AI_DISABLED',
            conversation_id: conversationId,
            customer_id: customerId,
            message_type: event.messageType,
          },
        });
      } catch (logErr) {
        console.warn('[AI Actions Log Error]', logErr);
      }

      return {
        status: 'SUCCESS',
        message: `Inbound message saved. AI response BLOCKED: Global AI is disabled (${aiGuardResult.blockedReason})`,
        organizationId: targetOrgId,
        conversationId,
      };
    }

    // 7b. Check if AI Auto-Reply is Suppressed (OBSERVE_ONLY, FOLLOWUP_ONLY, HUMAN_PRIMARY, HUMAN_ACTIVE, ESCALATED, PAUSED)
    const isOutboundSuppressed =
      !aiGuardResult.isAIOutboundAllowed ||
      (conversationMode as string) !== 'AI_ACTIVE';

    if (isOutboundSuppressed) {
      // EXCEPTION: Check if customer message explicitly confirms an order (e.g. "Oui je prends le kit")
      const rawText = (event.textBody || '').toLowerCase().trim();
      const isOrderConfirmation = /oui[\s,]*je (?:prends|confirme|commande|veux)/i.test(rawText) || /je confirme (?:la )?commande/i.test(rawText) || /valide (?:la )?commande/i.test(rawText);

      if (isOrderConfirmation) {
        // Fetch flowState or active product to attempt order execution
        const { data: convData } = await this.supabase
          .from('conversations')
          .select('metadata')
          .eq('id', conversationId)
          .single();

        const flowState = convData?.metadata?.flow_state || {};
        let targetProductId = flowState.productId;

        if (!targetProductId) {
          // Fallback: search product by name matching in text
          const { data: prods } = await this.supabase
            .from('products')
            .select('id, name')
            .eq('organization_id', targetOrgId)
            .eq('status', 'ACTIVE')
            .limit(1);

          if (prods && prods.length > 0) {
            targetProductId = prods[0].id;
          }
        }

        if (targetProductId) {
          const orderExecService = new OrderExecutionService(this.supabase);
          const execRes = await orderExecService.executeConfirmedOrder({
            organizationId: targetOrgId,
            customerId: customerId,
            conversationId,
            productId: targetProductId,
            quantity: flowState.quantity || 1,
            neighborhood: flowState.neighborhood || 'Benego',
            customerName: flowState.customerName,
            customerPhone: event.senderPhone,
          });

          if (execRes.success) {
            return {
              status: 'SUCCESS',
              message: `Inbound order confirmation processed automatically. ${execRes.message}`,
              organizationId: targetOrgId,
              conversationId,
            };
          }
        }
      }

      return {
        status: 'SUCCESS',
        message: `Inbound message saved and context updated. AI response suppressed in '${conversationMode}' mode (commercial handles active chat).`,
        organizationId: targetOrgId,
        conversationId,
      };
    }


    // 8. Execute AI Agent Completion (AI_ACTIVE)
    try {
      const { data: products } = await this.supabase
        .from('products')
        .select('*')
        .eq('organization_id', targetOrgId);

      const availableProducts = (products || []).map((p) => ({
        id: p.id,
        organizationId: targetOrgId,
        sku: p.sku || 'SKU-001',
        name: p.name,
        category: p.category || 'GENERAL',
        purchasePrice: Number(p.purchase_price || 0),
        sellingPrice: Number(p.selling_price || 0),
        currency: 'XOF',
        minimumStock: Number(p.alert_threshold || 5),
        unit: 'unités',
        status: p.status || 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const { data: historyMsgs } = await this.supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);

      const mappedMsgs = (historyMsgs || []).map((m) => ({
        id: m.id,
        organizationId: targetOrgId,
        conversationId: m.conversation_id,
        direction: m.direction,
        senderType: m.sender_type,
        messageType: m.message_type,
        content: m.content || '',
        status: m.status,
        metadata: m.metadata || {},
        sentAt: new Date(m.created_at),
        createdAt: new Date(m.created_at),
      }));

      const { data: realCustomer } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();

      const mockCustomer = {
        id: customerId,
        organizationId: targetOrgId,
        firstName: realCustomer?.first_name || event.senderName || 'Client',
        lastName: realCustomer?.last_name || event.senderPhone.slice(-4),
        fullName: realCustomer?.full_name || (realCustomer?.first_name ? `${realCustomer.first_name} ${realCustomer.last_name || ''}`.trim() : event.senderName || `Client ${event.senderPhone.slice(-4)}`),
        phone: realCustomer?.phone || event.senderPhone,
        city: realCustomer?.city || 'Ouagadougou',
        source: realCustomer?.source || 'WHATSAPP',
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Load & update Conversation Flow State
      const { data: convMetaData } = await this.supabase
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single();

      const currentFlowState: any = convMetaData?.metadata?.flow_state || {
        customerPhone: event.senderPhone,
        nextRequiredField: 'PRODUCT',
      };

      // Spontaneous Name Detection & Persistence (e.g. "Je m'appelle Wilfried" or "Wilfried Tiendré")
      const textRaw = (event.textBody || '').trim();
      const namePatterns = [
        /^je m'appelle ([a-zà-ÿ\s\-]+)/i,
        /^mon nom est ([a-zà-ÿ\s\-]+)/i,
        /^c'est ([a-zà-ÿ\s\-]+)$/i,
      ];

      for (const pat of namePatterns) {
        const match = textRaw.match(pat);
        if (match && match[1] && match[1].trim().length > 1) {
          const extractedName = match[1].trim();
          currentFlowState.customerName = extractedName;

          const parts = extractedName.split(' ');
          const fName = parts[0];
          const lName = parts.slice(1).join(' ') || 'WhatsApp';

          await this.supabase
            .from('customers')
            .update({ first_name: fName, last_name: lName, full_name: extractedName })
            .eq('id', customerId);

          mockCustomer.firstName = fName;
          mockCustomer.lastName = lName;
          mockCustomer.fullName = extractedName;
          break;
        }
      }

      if (realCustomer?.first_name && realCustomer.first_name !== 'Client' && !currentFlowState.customerName) {
        currentFlowState.customerName = `${realCustomer.first_name} ${realCustomer.last_name || ''}`.trim();
      }

      const { data: orgData } = await this.supabase
        .from('organizations')
        .select('settings')
        .eq('id', targetOrgId)
        .single();

      const aiConfig = orgData?.settings?.ai_agent_config || {};

      if (aiConfig.enabled === false) {
        return {
          status: 'SUCCESS',
          message: 'Inbound message saved. AI response suppressed: AI Agent is disabled in organization settings.',
          organizationId: targetOrgId,
          conversationId,
        };
      }

      // Check Operating Schedule
      if (aiConfig.schedule?.active) {
        const startTime = aiConfig.schedule.startTime || '08:00';
        const endTime = aiConfig.schedule.endTime || '20:00';
        const timezone = aiConfig.schedule.timezone || 'Africa/Ouagadougou';

        try {
          const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          const currentTime = timeFormatter.format(new Date());

          if (currentTime < startTime || currentTime > endTime) {
            console.log(`[AI BLOCKED — OUTSIDE HOURS] Current: ${currentTime}, Range: ${startTime} - ${endTime}`);
            return {
              status: 'SUCCESS',
              message: `AI BLOCKED — OUTSIDE CONFIGURED HOURS (${startTime} - ${endTime} ${timezone})`,
              organizationId: targetOrgId,
              conversationId,
            };
          }
        } catch (scheduleErr: any) {
          console.warn('[Schedule Check Warning]', scheduleErr);
        }
      }

      const productRepo = new SupabaseProductRepository(this.supabase);
      const orderRepo = new InMemoryOrderRepository();
      const dummyAuditRepo: any = { log: async () => {} };
      const dummyEventRepo: any = { publish: async () => {} };

      const createOrderService = new CreateOrderService(orderRepo, productRepo, dummyAuditRepo, dummyEventRepo);
      const toolsRegistry = new AIToolsRegistry(productRepo, orderRepo, createOrderService);

      const aiGateway = new AnthropicAIGateway();
      const contextService = new SalesAgentContextService();
      const salesAgentService = new SalesAgentService(aiGateway, contextService, toolsRegistry);

      const execOptions = {
        supabase: this.supabase,
        providerAdapter: this.providerAdapter,
        providerIdentity,
        destinationPhone: event.senderPhone,
        conversationId,
      };

      let activeAttribution: any = event.attribution || null;
      if (activeAttribution) {
        try {
          const attrService = new MarketingAttributionService(this.supabase);
          const attrRes = await attrService.recordAttribution({
            organizationId: targetOrgId,
            customerId,
            conversationId,
            source: activeAttribution.source || 'UNKNOWN',
            sourceType: activeAttribution.sourceType,
            platform: activeAttribution.platform,
            adId: activeAttribution.adId,
            adName: activeAttribution.adName,
            productName: activeAttribution.productName,
            sourceUrl: activeAttribution.sourceUrl,
            confidence: activeAttribution.confidence || 'UNKNOWN',
            attributionMethod: activeAttribution.attributionMethod || 'UNKNOWN',
          });
          activeAttribution = attrRes.lastTouch;
        } catch (attrErr) {
          console.warn('[Attribution Recording Warning]', attrErr);
        }
      }

      let imageInput: { base64: string; mimeType: string } | null = null;
      let imageAccessFailed = false;

      if (event.messageType === 'IMAGE') {
        const imageBuf = await this.fetchImageBufferWithRetry(event);
        if (imageBuf) {
          imageInput = {
            base64: imageBuf.toString('base64'),
            mimeType: this.detectImageMimeType(imageBuf),
          };
        } else {
          imageAccessFailed = true;
          console.warn(`[WhatsAppApplicationService] IMAGE media fetch/decryption failed for externalMessageId=${event.externalMessageId}`);
        }
      }

      const startTimeMs = Date.now();
      const aiResult = await salesAgentService.generateResponse(
        mockCustomer,
        mappedMsgs,
        availableProducts,
        targetOrgId,
        aiConfig,
        execOptions,
        activeAttribution,
        imageInput,
        imageAccessFailed,
        currentFlowState
      );
      const latencyMs = Date.now() - startTimeMs;

      // Log AI token usage to Supabase ai_usage_logs
      if (aiResult.usage) {
        try {
          await this.supabase.from('ai_usage_logs').insert({
            organization_id: targetOrgId,
            provider: 'anthropic',
            model: aiResult.usage.model,
            prompt_tokens: aiResult.usage.promptTokens,
            completion_tokens: aiResult.usage.completionTokens,
            total_tokens: aiResult.usage.totalTokens,
            estimated_cost: aiResult.usage.estimatedCostUsd || 0,
            latency_ms: latencyMs,
            operation: 'WHATSAPP_SALES_AGENT',
            correlation_id: conversationId,
          });
        } catch (logErr: any) {
          console.warn('[AI Usage Log Insert Error]', logErr?.message);
        }
      }

      // 9. Send Outbound Message via Provider Adapter FIRST
      const sendResult = await this.providerAdapter.sendTextMessage(providerIdentity, {
        toPhoneNumber: event.senderPhone,
        messageText: aiResult.responseText,
      });

      const isSentOk = sendResult.status === 'SENT';

      if (!isSentOk) {
        console.error(`[OUTBOUND_WHATSAPP_FAILED] Evolution API send failed [${sendResult.errorCode}] for ${event.senderPhone}`);
      }

      // 10. Save Outbound AI Response
      await this.supabase.from('messages').insert({
        organization_id: targetOrgId,
        conversation_id: conversationId,
        customer_id: customerId || null,
        direction: 'OUTBOUND',
        sender_type: 'AI',
        sender_id: 'SALES_AI',
        message_type: 'TEXT',
        content: aiResult.responseText,
        external_message_id: isSentOk ? sendResult.externalMessageId : null,
        status: isSentOk ? 'SENT' : 'FAILED',
        error_code: isSentOk ? null : (sendResult.errorCode || 'OUTBOUND_FAILED'),
      });

      // Handle Handoff if triggered by AI
      if (aiResult.triggerHandoff) {
        await this.supabase.from('human_handoffs').insert({
          organization_id: targetOrgId,
          conversation_id: conversationId,
          reason: 'Le client demande un conseiller humain',
          status: 'PENDING',
        });

        await this.supabase
          .from('conversations')
          .update({ conversation_mode: 'ESCALATED', assigned_agent: 'HUMAN' })
          .eq('id', conversationId);
      }

      return {
        status: 'SUCCESS',
        message: 'Inbound message processed and AI response sent via provider.',
        organizationId: targetOrgId,
        conversationId,
      };
    } catch (aiErr: any) {
      console.warn(`[AI_RESPONSE_BLOCKED] ${aiErr.message}`);
      return {
        status: 'SUCCESS',
        message: `Message entrant enregistré. Réponse IA bloquée : ${aiErr.message}`,
        organizationId: targetOrgId,
        conversationId,
      };
    }
  }
}
