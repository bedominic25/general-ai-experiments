import { prisma } from "../db/client.js";
import { logger } from "../observability/logger.js";
import { aiAssistantErrors, aiAssistantLatency } from "../observability/metrics.js";
import { serializeProduct } from "../products/service.js";
import { embed } from "./vectorizer.js";
import { getVectorStore } from "./vectorStore.js";
import { getLlmProvider } from "./llmProvider.js";

const HISTORY_TURNS = 10;
const TOP_K = 5;

export interface RetrieveResult {
  productId: string;
  score: number;
}

/** Retrieval-only path (no LLM call) - used by the AI search box and by the retrieval regression tests. */
export async function retrieveProducts(query: string, topK = TOP_K): Promise<RetrieveResult[]> {
  const store = getVectorStore();
  const matches = await store.search(embed(query), topK);
  return matches;
}

export async function chatWithAssistant(sessionId: string, userId: string | undefined, message: string) {
  const start = Date.now();
  const provider = getLlmProvider();

  let matches: RetrieveResult[];
  try {
    matches = await retrieveProducts(message, TOP_K);
  } catch (err) {
    aiAssistantErrors.inc({ stage: "retrieval" });
    logger.error({ err }, "Retrieval failed");
    throw err;
  }

  const products = await prisma.product.findMany({ where: { id: { in: matches.map((m) => m.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const ranked = matches.map((m) => byId.get(m.productId)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: HISTORY_TURNS,
  });

  let reply: string;
  try {
    reply = await provider.generateReply({
      query: message,
      history: history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      retrieved: ranked.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, description: p.description })),
    });
  } catch (err) {
    aiAssistantErrors.inc({ stage: "generation" });
    logger.error({ err, provider: provider.name }, "LLM generation failed");
    throw err;
  }

  const latencyMs = Date.now() - start;

  await prisma.chatMessage.create({ data: { sessionId, userId, role: "user", content: message } });
  await prisma.chatMessage.create({
    data: {
      sessionId,
      userId,
      role: "assistant",
      content: reply,
      retrievedProducts: JSON.stringify(ranked.map((p) => p.id)),
      latencyMs,
    },
  });

  aiAssistantLatency.observe({ llm_provider: provider.name }, latencyMs / 1000);

  return {
    reply,
    provider: provider.name,
    latencyMs,
    retrievedProducts: ranked.map(serializeProduct),
  };
}

export async function getChatHistory(sessionId: string) {
  return prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
}
