export interface SafetyCheckResult {
  flagged: boolean;
  matches: string[];
}

/**
 * Lightweight, pattern-based prompt-injection detection.
 *
 * IMPORTANT and worth saying out loud in an interview: this is a heuristic,
 * not a production-grade classifier. Real injection attempts are far more
 * varied than any fixed regex list can cover (encoding tricks, indirection
 * through retrieved documents, multi-turn setups, etc.). This module exists
 * to demonstrate the *pattern* -- catch the obvious cases fast and cheaply,
 * log what's caught and what isn't -- not to claim comprehensive coverage.
 * A production system would pair this with a dedicated moderation/classifier
 * model and treat this list as a fast first-pass filter.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|any|the)?\s*(previous|prior|above)\s*(instructions|rules|prompt)/i,
  /disregard (all|any|the)?\s*(previous|prior|above)\s*(instructions|rules)/i,
  /you are now (in )?(developer|debug|god|jailbreak)\s*mode/i,
  /reveal (your )?(system prompt|instructions|hidden prompt)/i,
  /act as (an? )?(unrestricted|uncensored|jailbroken)/i,
  /pretend (you have|to have) no (restrictions|guidelines|rules)/i,
];

/**
 * Similarly illustrative: a short list standing in for a real moderation
 * pass. In production this would call a dedicated safety/moderation
 * endpoint rather than regex-matching model output.
 */
const UNSAFE_OUTPUT_PATTERNS: RegExp[] = [
  /how to (make|build|synthesize)\s*(a\s*)?(bomb|explosive|bioweapon)/i,
  /step[- ]by[- ]step.*(hack|breach).*(without (detection|authorization))/i,
];

export function detectPromptInjection(inputPrompt: string): SafetyCheckResult {
  const matches = INJECTION_PATTERNS.filter((re) => re.test(inputPrompt)).map((re) => re.source);
  return { flagged: matches.length > 0, matches };
}

export function detectUnsafeOutput(responseText: string): SafetyCheckResult {
  const matches = UNSAFE_OUTPUT_PATTERNS.filter((re) => re.test(responseText)).map((re) => re.source);
  return { flagged: matches.length > 0, matches };
}
