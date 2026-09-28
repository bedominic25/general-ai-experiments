import type { z } from 'zod';

export interface SchemaValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
}

/**
 * Models frequently wrap JSON in prose or ```json code fences even when told
 * not to. Extract the first fenced block if present, otherwise fall back to
 * treating the whole response as JSON.
 */
function extractJsonText(rawText: string): string {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : rawText).trim();
}

export function validateStructured<T>(rawText: string, schema: z.ZodType<T>): SchemaValidationResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(rawText));
  } catch (err) {
    return { valid: false, error: `Response is not valid JSON: ${(err as Error).message}` };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { valid: false, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { valid: true, data: result.data };
}
