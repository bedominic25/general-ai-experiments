import http from "k6/http";
import { check, sleep } from "k6";

// Write-path load test: register -> add to cart -> checkout. Lower target
// VUs than the read-path tests since every iteration mutates state
// (creates a user, an order, and decrements stock) - point this at a
// disposable database, never at a shared dev/staging one with real data.
const BASE_URL = __ENV.API_BASE_URL || "http://localhost:4000";
const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

export const options = {
  scenarios: {
    checkout: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 5 },
        { duration: "20s", target: 5 },
        { duration: "5s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<600"],
  },
};

export default function () {
  const email = `k6-${__VU}-${__ITER}-${Date.now()}@example.com`;

  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ email, password: "Password123!", name: "k6 Load Test User" }),
    JSON_HEADERS,
  );
  check(registerRes, { "register status is 201": (r) => r.status === 201 });
  const token = JSON.parse(registerRes.body).token;
  const authHeaders = { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } };

  const productsRes = http.get(`${BASE_URL}/api/products?pageSize=1`);
  const productId = JSON.parse(productsRes.body).items[0]?.id;

  if (productId) {
    const addRes = http.post(`${BASE_URL}/api/cart`, JSON.stringify({ productId, quantity: 1 }), authHeaders);
    check(addRes, { "add to cart status is 200": (r) => r.status === 200 });

    const checkoutRes = http.post(`${BASE_URL}/api/orders`, null, authHeaders);
    check(checkoutRes, { "checkout status is 201 or 400": (r) => r.status === 201 || r.status === 400 });
  }

  sleep(1);
}
