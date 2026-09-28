import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "../../src/auth/jwt.js";

describe("jwt", () => {
  it("round-trips a payload through sign/verify", () => {
    const token = signToken({ sub: "user_1", email: "a@b.com", role: "customer" });
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe("user_1");
    expect(decoded.email).toBe("a@b.com");
    expect(decoded.role).toBe("customer");
  });

  it("rejects a tampered token", () => {
    const token = signToken({ sub: "user_1", email: "a@b.com", role: "customer" });
    const tampered = `${token.slice(0, -2)}xx`;
    expect(() => verifyToken(tampered)).toThrow();
  });
});
