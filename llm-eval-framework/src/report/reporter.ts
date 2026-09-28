export interface CaseResult {
  id: string;
  category: string;
  prompt: string;
  passed: boolean;
  latencyMs: number;
  costUsd: number;
  relevanceScore?: number;
  schemaValid?: boolean;
  injectionFlagged?: boolean;
  unsafeOutputFlagged?: boolean;
  notes: string[];
}

export interface EvaluationReport {
  generatedAt: string;
  summary: {
    totalCases: number;
    passed: number;
    failed: number;
    avgLatencyMs: number;
    totalCostUsd: number;
    injectionsCaught: number;
    unsafeOutputsCaught: number;
  };
  results: CaseResult[];
}

const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
const sum = (nums: number[]) => nums.reduce((a, b) => a + b, 0);

export function buildReport(results: CaseResult[]): EvaluationReport {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalCases: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      avgLatencyMs: Math.round(avg(results.map((r) => r.latencyMs))),
      totalCostUsd: Number(sum(results.map((r) => r.costUsd)).toFixed(6)),
      injectionsCaught: results.filter((r) => r.injectionFlagged).length,
      unsafeOutputsCaught: results.filter((r) => r.unsafeOutputFlagged).length,
    },
    results,
  };
}

export function toJson(report: EvaluationReport): string {
  return JSON.stringify(report, null, 2);
}

export function toHtml(report: EvaluationReport): string {
  const rows = report.results
    .map((r) => {
      const statusColor = r.passed ? '#2E7D46' : '#C0392B';
      const notes = r.notes.length ? `<ul>${r.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : '—';
      return `<tr>
        <td>${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.category)}</td>
        <td style="color:${statusColor};font-weight:600;">${r.passed ? 'PASS' : 'FAIL'}</td>
        <td>${r.latencyMs.toFixed(0)} ms</td>
        <td>$${r.costUsd.toFixed(6)}</td>
        <td>${r.relevanceScore !== undefined ? r.relevanceScore.toFixed(2) : '—'}</td>
        <td>${r.schemaValid !== undefined ? (r.schemaValid ? 'valid' : 'invalid') : '—'}</td>
        <td>${r.injectionFlagged ? 'flagged' : '—'}</td>
        <td>${r.unsafeOutputFlagged ? 'flagged' : '—'}</td>
        <td>${notes}</td>
      </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>LLM Evaluation Report</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 32px; color: #1a1a1a; background: #fafafa; }
  h1 { margin-bottom: 4px; }
  .generated { color: #666; font-size: 13px; margin-bottom: 24px; }
  .summary { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
  .card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px 18px; min-width: 120px; }
  .card .n { font-size: 22px; font-weight: 700; }
  .card .l { font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 0.04em; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; font-size: 13px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  ul { margin: 0; padding-left: 16px; }
</style>
</head>
<body>
  <h1>LLM Evaluation Report</h1>
  <div class="generated">Generated ${escapeHtml(report.generatedAt)}</div>
  <div class="summary">
    <div class="card"><div class="n">${report.summary.passed}/${report.summary.totalCases}</div><div class="l">Passed</div></div>
    <div class="card"><div class="n">${report.summary.avgLatencyMs} ms</div><div class="l">Avg Latency</div></div>
    <div class="card"><div class="n">$${report.summary.totalCostUsd}</div><div class="l">Total Cost</div></div>
    <div class="card"><div class="n">${report.summary.injectionsCaught}</div><div class="l">Injections Caught</div></div>
    <div class="card"><div class="n">${report.summary.unsafeOutputsCaught}</div><div class="l">Unsafe Outputs Caught</div></div>
  </div>
  <table>
    <thead><tr>
      <th>ID</th><th>Category</th><th>Status</th><th>Latency</th><th>Cost</th>
      <th>Relevance</th><th>Schema</th><th>Injection</th><th>Unsafe Output</th><th>Notes</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
