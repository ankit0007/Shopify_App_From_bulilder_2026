import { describe, expect, it } from "vitest";
import { DevelopmentSubmissionRateLimiter } from "./submission-rate-limit.server";

describe("development submission rate limiter", () => {
  it("limits a key within its configured window and allows it after expiry", () => {
    let now = 1_000;
    const limiter = new DevelopmentSubmissionRateLimiter(() => now, 2, 1_000);

    expect(limiter.allow("shop-a:ip-a")).toBe(true);
    expect(limiter.allow("shop-a:ip-a")).toBe(true);
    expect(limiter.allow("shop-a:ip-a")).toBe(false);
    expect(limiter.allow("shop-a:ip-b")).toBe(true);

    now += 1_001;
    expect(limiter.allow("shop-a:ip-a")).toBe(true);
  });
});
