import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// Load test for the RAG shopping-assistant pipeline (retrieval + LLM
// generation) - the most latency-sensitive endpoint in the app, and the one
// whose p95/p99 the CloudWatch dashboards in infra/terraform/dashboards.tf
// are built around. Defaults to the mock LLM provider's latency profile;
// point API_BASE_URL at an instance with LLM_PROVIDER=claude to load-test
// real generation latency instead (mind Anthropic rate limits when you do).
const BASE_URL = __ENV.API_BASE_URL || "http://localhost:4000";

const QUESTIONS = [
  "I need something warm for winter trail running",
  "noise cancelling wireless earbuds with long battery life",
  "a HEPA air purifier for a bedroom",
  "a tent for a 3 season backpacking trip",
  "adjustable dumbbells for home workouts",
];

export const options = {
  scenarios: {
    assistant_chat: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 5 },
        { duration: "30s", target: 5 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    // Generous vs. product-search.js: this endpoint does retrieval + an LLM call.
    http_req_duration: ["p(95)<3000"],
  },
};

export default function () {
  const sessionId = uuidv4();
  const message = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

  const res = http.post(
    `${BASE_URL}/api/ai/chat`,
    JSON.stringify({ sessionId, message }),
    { headers: { "Content-Type": "application/json" } },
  );

  check(res, {
    "chat status is 200": (r) => r.status === 200,
    "chat returns a non-empty reply": (r) => JSON.parse(r.body).reply.length > 0,
  });

  sleep(2);
}
