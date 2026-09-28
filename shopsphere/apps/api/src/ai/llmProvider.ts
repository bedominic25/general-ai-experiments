import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RetrievedProductContext {
  id: string;
  name: string;
  priceCents: number;
  description: string;
}

export interface AssistantContext {
  query: string;
  history: ChatTurn[];
  retrieved: RetrievedProductContext[];
}

export interface LlmProvider {
  readonly name: string;
  generateReply(ctx: AssistantContext): Promise<string>;
}

const SYSTEM_PROMPT = [
  "You are the ShopSphere shopping assistant.",
  "Answer using ONLY the candidate products supplied to you - never invent products, prices, or stock status.",
  "Be concise (2-4 sentences), friendly, and recommend at most 3 products by name.",
  "If none of the candidates fit the request, say so plainly and ask a clarifying question.",
].join(" ");

function formatCandidates(retrieved: RetrievedProductContext[]): string {
  if (retrieved.length === 0) {
    return "No matching products were found in the catalog for this query.";
  }
  return retrieved
    .map((p, i) => `${i + 1}. ${p.name} - $${(p.priceCents / 100).toFixed(2)} - ${p.description}`)
    .join("\n");
}

/** Real generation path: Anthropic's Messages API, grounded on our own retrieval step (not Claude's). */
export class ClaudeProvider implements LlmProvider {
  readonly name = "claude";
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generateReply(ctx: AssistantContext): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 400,
      system: `${SYSTEM_PROMPT}\n\nCandidate products:\n${formatCandidates(ctx.retrieved)}`,
      messages: [
        ...ctx.history.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user" as const, content: ctx.query },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }
}

/**
 * Deterministic stand-in used by default in tests/CI (LLM_PROVIDER=mock) so
 * the regression suite never depends on network access, API cost, or model
 * non-determinism. Its output is a pure function of the retrieved products,
 * which is exactly what tests/specs/llm/regression.spec.ts pins against.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  async generateReply(ctx: AssistantContext): Promise<string> {
    if (ctx.retrieved.length === 0) {
      return `I couldn't find anything in the catalog matching "${ctx.query}". Could you tell me a bit more about what you're looking for?`;
    }

    const [top, ...rest] = ctx.retrieved;
    const price = (top.priceCents / 100).toFixed(2);
    let reply = `Based on "${ctx.query}", I'd recommend the ${top.name} ($${price}).`;
    if (rest.length > 0) {
      reply += ` Other options worth a look: ${rest.map((p) => p.name).join(", ")}.`;
    }
    return reply;
  }
}

let provider: LlmProvider | undefined;

export function getLlmProvider(): LlmProvider {
  if (!provider) {
    provider =
      env.LLM_PROVIDER === "claude" && env.ANTHROPIC_API_KEY
        ? new ClaudeProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL)
        : new MockLlmProvider();
  }
  return provider;
}

/** Test-only escape hatch for injecting a fake provider without touching env vars. */
export function setLlmProviderForTests(fake: LlmProvider | undefined): void {
  provider = fake;
}
