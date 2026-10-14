/**
 * WILLShop OS — Anthropic Claude AI Gateway Implementation
 * Infrastructure Layer.
 * Provides real Anthropic Claude completion and Tool Calling capability.
 */

import { IAIGateway, AIModelRequest, AIModelResponse } from '../../domain/interfaces/IAIGateway';

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export class AnthropicAIGateway implements IAIGateway {
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    const rawKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.apiKey = rawKey.trim().replace(/^["']|["']$/g, '');
    // AUDIT FIX: 'claude-sonnet-5' does not exist — use 'claude-sonnet-4-5' or override via ANTHROPIC_MODEL env var
    this.defaultModel = (defaultModel || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5').trim().replace(/^["']|["']$/g, '');
  }

  async generateCompletion(
    request: AIModelRequest & { tools?: AnthropicToolDefinition[] }
  ): Promise<AIModelResponse & { toolCalls?: Array<{ id: string; name: string; input: any }> }> {
    if (!this.apiKey || !this.apiKey.trim()) {
      console.error('[AnthropicAIGateway Error] ANTHROPIC_API_KEY is missing or empty in environment variables.');
      throw new Error('BLOCKED — ANTHROPIC_API_KEY missing');
    }

    const targetModel = request.model || this.defaultModel;
    const systemMessage = request.messages.find((m) => m.role === 'system')?.content || '';
    const userMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    try {
      // Build prompt caching structured system block
      const systemBlock: Array<{ type: string; text: string; cache_control?: { type: 'ephemeral' } }> = [];
      if (systemMessage) {
        systemBlock.push({
          type: 'text',
          text: systemMessage,
          cache_control: { type: 'ephemeral' },
        });
      }

      const payload: Record<string, any> = {
        model: targetModel,
        // AUDIT FIX: 400 tokens was too low for complex CEO briefings — raised to 2048
        max_tokens: request.maxTokens || 2048,
        system: systemBlock.length > 0 ? systemBlock : systemMessage,
        messages: userMessages,
      };

      // AUDIT FIX: claude-sonnet-4-5 does not support temperature parameter (extended thinking models)
      if (request.temperature !== undefined && !targetModel.includes('claude-sonnet-4-5')) {
        payload.temperature = request.temperature;
      }

      if (request.tools && request.tools.length > 0) {
        // Tag last tool definition with ephemeral cache control for Anthropic Prompt Caching
        const toolsWithCache = request.tools.map((t, idx) => {
          if (idx === request.tools!.length - 1) {
            return { ...t, cache_control: { type: 'ephemeral' } };
          }
          return t;
        });
        payload.tools = toolsWithCache;
      }

      // AUDIT FIX: Add retry logic for HTTP 529 (Anthropic overloaded) — up to 3 attempts with exponential backoff
      let response: Response | null = null;
      let lastError: string = '';
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'prompt-caching-2024-07-31',
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) break;

        // Retry only on 529 (overloaded) or 503 (service unavailable)
        if ((response.status === 529 || response.status === 503) && attempt < maxRetries) {
          const backoffMs = attempt * 1500;
          console.warn(`[AnthropicAIGateway] HTTP ${response.status} — retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        lastError = await response.text().catch(() => '');
        console.error(`[AnthropicAIGateway API Error] HTTP ${response.status} ${response.statusText} | Model: ${targetModel}`, {
          httpStatus: response.status,
          statusText: response.statusText,
          errorBody: lastError,
        });
        throw new Error(`Anthropic API HTTP ${response.status}: ${lastError || response.statusText}`);
      }

      if (!response || !response.ok) {
        lastError = response ? await response.text().catch(() => '') : 'No response';
        throw new Error(`Anthropic API failed after ${maxRetries} attempts: ${lastError}`);
      }

      const resData = await response.json();
      let textContent = '';
      const toolCalls: Array<{ id: string; name: string; input: any }> = [];

      for (const block of resData.content || []) {
        if (block.type === 'text') {
          textContent += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }

      const promptTokens = resData.usage?.input_tokens || 0;
      const completionTokens = resData.usage?.output_tokens || 0;
      const cacheCreationInputTokens = resData.usage?.cache_creation_input_tokens || 0;
      const cacheReadInputTokens = resData.usage?.cache_read_input_tokens || 0;
      const totalTokens = promptTokens + completionTokens + cacheCreationInputTokens + cacheReadInputTokens;

      // Calculate estimated cost USD for Anthropic Claude models
      const isHaiku = targetModel.toLowerCase().includes('haiku');
      const baseInputRate = isHaiku ? 0.000001 : 0.000003;
      const cacheReadRate = isHaiku ? 0.0000001 : 0.0000003;
      const cacheCreateRate = isHaiku ? 0.00000125 : 0.00000375;
      const outputRate = isHaiku ? 0.000005 : 0.000015;

      const estimatedCostUsd =
        (promptTokens * baseInputRate) +
        (cacheReadInputTokens * cacheReadRate) +
        (cacheCreationInputTokens * cacheCreateRate) +
        (completionTokens * outputRate);

      return {
        content: textContent,
        promptTokens,
        completionTokens,
        cacheCreationInputTokens,
        cacheReadInputTokens,
        totalTokens,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
        model: resData.model || targetModel,
        provider: 'anthropic',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (err: any) {
      console.error('[AnthropicAIGateway Exception]', {
        message: err.message,
        model: this.defaultModel,
        stack: err.stack,
      });
      return {
        content: "Désolé, je rencontre une petite difficulté technique. Un conseiller commercial va prendre le relais.",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: this.defaultModel,
        provider: 'anthropic-error',
      };
    }
  }
}
