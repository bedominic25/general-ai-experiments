import type { LLMProvider } from '../providers/types';

export interface RelevanceResult {
  score: number; // 0-1
  matched: string[];
  missing: string[];
}

/**
 * Deterministic, zero-extra-API-call relevance check: does the response
 * contain the terms we expect a correct/on-topic answer to contain?
 * Cheap and explainable, but shallow -- it can't tell "Paris" from "not Paris,
 * but happens to mention Paris in passing." Use `llmJudgeRelevance` below for
 * a deeper (and more expensive) check.
 */
export function keywordRelevance(responseText: string, mustInclude: string[]): RelevanceResult {
  const lower = responseText.toLowerCase();
  const matched = mustInclude.filter((term) => lower.includes(term.toLowerCase()));
  const missing = mustInclude.filter((term) => !lower.includes(term.toLowerCase()));
  const score = mustInclude.length === 0 ? 1 : matched.length / mustInclude.length;
  return { score, matched, missing };
}

/**
 * LLM-as-judge relevance scoring: ask the same model to rate its own answer's
 * relevance to the original prompt, 1-5. This is a real, widely-used eval
 * pattern (and a good interview talking point), but it costs an extra API
 * call per case and its own accuracy isn't guaranteed -- treat it as a
 * second, softer signal, not ground truth. Not wired into the default CI run
 * to keep it fast and cheap; see README for how to enable it.
 */
export async function llmJudgeRelevance(provider: LLMProvider, prompt: string, responseText: string): Promise<number> {
  const judgePrompt = [
    "You are grading an AI assistant's response for relevance to the user's request.",
    '',
    `User request:\n${prompt}`,
    '',
    `AI response:\n${responseText}`,
    '',
    'Rate relevance from 1 (irrelevant) to 5 (fully relevant and on-topic). Reply with ONLY the digit.',
  ].join('\n');

  const judged = await provider.complete(judgePrompt, { maxTokens: 5 });
  const score = Number.parseInt(judged.text.trim(), 10);
  return Number.isFinite(score) ? score : 0;
}
