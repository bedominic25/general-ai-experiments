import fs from 'node:fs';
import path from 'node:path';
import { test, expect, request as pwRequest } from '@playwright/test';
import { AnthropicProvider, costUsd } from '../src/providers/anthropic';
import { validateStructured } from '../src/scoring/schema';
import { keywordRelevance } from '../src/scoring/relevance';
import { detectPromptInjection, detectUnsafeOutput } from '../src/scoring/safety';
import { buildReport, toHtml, toJson, type CaseResult } from '../src/report/reporter';
import { cases } from '../test-cases/cases';

const results: CaseResult[] = [];

test.describe('LLM evaluation suite', () => {
  let provider: AnthropicProvider;

  test.beforeAll(async () => {
    // Playwright's request context is an HTTP client -- no browser is launched.
    // This is what lets this suite run in CI without `playwright install`.
    const requestContext = await pwRequest.newContext();
    provider = new AnthropicProvider(requestContext);
  });

  for (const testCase of cases) {
    test(`${testCase.id} — ${testCase.category}`, async () => {
      const notes: string[] = [];
      const promptInjectionCheck = detectPromptInjection(testCase.prompt);

      const response = await provider.complete(testCase.prompt, { system: testCase.system });
      const cost = costUsd(provider.model, response.inputTokens, response.outputTokens);
      const unsafeOutputCheck = detectUnsafeOutput(response.text);

      const result: CaseResult = {
        id: testCase.id,
        category: testCase.category,
        prompt: testCase.prompt,
        passed: true, // set false below on any assertion path we know failed
        latencyMs: response.latencyMs,
        costUsd: cost,
        injectionFlagged: promptInjectionCheck.flagged,
        unsafeOutputFlagged: unsafeOutputCheck.flagged,
        notes,
      };

      try {
        if (testCase.expectInjectionFlag) {
          expect(promptInjectionCheck.flagged, 'expected this prompt to be flagged as an injection attempt').toBe(
            true,
          );
        }

        if (testCase.schema) {
          const validation = validateStructured(response.text, testCase.schema);
          result.schemaValid = validation.valid;
          if (!validation.valid) notes.push(`schema: ${validation.error}`);
          expect(validation.valid, `structured response failed schema validation: ${validation.error}`).toBe(true);
        }

        if (testCase.mustInclude) {
          const relevance = keywordRelevance(response.text, testCase.mustInclude);
          result.relevanceScore = relevance.score;
          if (relevance.missing.length) notes.push(`missing terms: ${relevance.missing.join(', ')}`);
          expect(relevance.score, `relevance ${relevance.score} below threshold`).toBeGreaterThanOrEqual(
            testCase.minRelevance ?? 0.5,
          );
        }

        expect(unsafeOutputCheck.flagged, 'response was flagged as potentially unsafe output').toBe(false);
      } catch (err) {
        result.passed = false;
        throw err;
      } finally {
        results.push(result);
      }
    });
  }

  test.afterAll(async () => {
    const report = buildReport(results);
    const outDir = path.join(process.cwd(), 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'evaluation-report.json'), toJson(report));
    fs.writeFileSync(path.join(outDir, 'evaluation-report.html'), toHtml(report));
    console.log(`\nEvaluation report written to ${outDir}/evaluation-report.html`);
  });
});
