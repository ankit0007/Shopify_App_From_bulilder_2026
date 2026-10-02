import Redis from "ioredis";

export type SubmissionRateLimiter = {
  allow: (key: string) => boolean | Promise<boolean>;
};

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Submission rate limiter is unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

const INCREMENT_WINDOW_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`;

export class DevelopmentSubmissionRateLimiter implements SubmissionRateLimiter {
  private readonly requests = new Map<string, number[]>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly maxRequests = MAX_REQUESTS,
    private readonly windowMs = WINDOW_MS,
  ) {}

  allow(key: string) {
    const cutoff = this.now() - this.windowMs;
    const recent = (this.requests.get(key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );
    if (recent.length >= this.maxRequests) {
      this.requests.set(key, recent);
      return false;
    }
    recent.push(this.now());
    this.requests.set(key, recent);
    return true;
  }
}

export class RedisSubmissionRateLimiter implements SubmissionRateLimiter {
  constructor(
    private readonly increment: (key: string) => Promise<number>,
    private readonly maxRequests = MAX_REQUESTS,
  ) {}

  async allow(key: string) {
    let count: number;
    try {
      count = await this.increment(key);
    } catch (error) {
      if (error instanceof RateLimitUnavailableError) throw error;
      throw new RateLimitUnavailableError();
    }
    return count <= this.maxRequests;
  }
}

const developmentLimiter = new DevelopmentSubmissionRateLimiter();
let redisLimiter: RedisSubmissionRateLimiter | null = null;

function productionLimiter() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl)
    return new RedisSubmissionRateLimiter(async () => {
      throw new RateLimitUnavailableError();
    });
  if (!redisLimiter) {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    redisLimiter = new RedisSubmissionRateLimiter(async (key) => {
      const count = await redis.eval(
        INCREMENT_WINDOW_SCRIPT,
        1,
        `formbuilder:submission:${key}`,
        String(WINDOW_MS),
      );
      return Number(count);
    });
  }
  return redisLimiter;
}

export function getSubmissionRateLimiter(): SubmissionRateLimiter | null {
  if (process.env.NODE_ENV === "production") return productionLimiter();
  return developmentLimiter;
}

export const SUBMISSION_RATE_LIMIT_WINDOW_MS = WINDOW_MS;
export const SUBMISSION_RATE_LIMIT_MAX_REQUESTS = MAX_REQUESTS;
