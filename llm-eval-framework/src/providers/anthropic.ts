import type { APIRequestContext } from '@playwright/test';
import type { CompleteOptions, LLMProvider, LLMResponse } from './types';

/**
 * Approximate USD price per 1M tokens, by model. Anthropic's pricing changes
 * over time -- verify against https://www.anthropic.com/pricing before citing
 * real cost numbers anywhere (e.g. an interview). This table exists so the
 * framework can demonstrate cost tracking; treat the numbers as illustrative.
 */
const PRICING_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_1M_TOKENS[model] ?? { input: 0, output: 0 };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly request: APIRequestContext,
    readonly model: string = process.env.LLM_EVAL_MODEL ?? 'claude-haiku-4-5-20251001',
    private readonly apiKey: string | undefined = process.env.ANTHROPIC_API_KEY,
  ) {
    if (!this.apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Export it in your shell, or add it as a GitHub Actions secret for CI.',
      );
    }
  }

  async complete(prompt: string, opts: CompleteOptions = {}): Promise<LLMResponse> {
    const start = performance.now();

    const response = await this.request.post('https://api.anthropic.com/v1/messages', {
      headers: {
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      data: {
        model: this.model,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content: prompt }],
      },
    });

    const latencyMs = performance.now() - start;

    if (!response.ok()) {
      throw new Error(`Anthropic API error ${response.status()}: ${await response.text()}`);
    }

    const body = (await response.json()) as AnthropicMessageResponse;
    const text = body.content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join('');

    return {
      text,
      inputTokens: body.usage.input_tokens,
      outputTokens: body.usage.output_tokens,
      latencyMs,
    };
  }
}
