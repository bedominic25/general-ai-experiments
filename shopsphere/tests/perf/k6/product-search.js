import http from "k6/http";
import { check, sleep } from "k6";

// Baseline read-path load test: product listing/search/detail, the highest
// QPS endpoints in a real storefront. Run with:
//   k6 run -e API_BASE_URL=http://localhost:4000 tests/perf/k6/product-search.js
const BASE_URL = __ENV.API_BASE_URL || "http://localhost:4000";

const QUERIES = ["shoes", "coffee", "tent", "earbuds", "yoga", "jacket", ""];

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 20 },
        { duration: "40s", target: 20 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<400", "p(99)<800"],
  },
};

export default function () {
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const listRes = http.get(`${BASE_URL}/api/products?q=${encodeURIComponent(query)}`);
  check(listRes, {
    "product list status is 200": (r) => r.status === 200,
    "product list has items": (r) => JSON.parse(r.body).items.length >= 0,
  });

  const items = JSON.parse(listRes.body).items;
  if (items.length > 0) {
    const detailRes = http.get(`${BASE_URL}/api/products/${items[0].id}`);
    check(detailRes, { "product detail status is 200": (r) => r.status === 200 });
  }

  sleep(1);
}
