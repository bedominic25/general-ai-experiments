export interface CompleteOptions {
  system?: string;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  complete(prompt: string, opts?: CompleteOptions): Promise<LLMResponse>;
}
