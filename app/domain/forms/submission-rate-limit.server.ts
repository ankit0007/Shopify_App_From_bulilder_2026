export type SubmissionRateLimiter = {
  allow: (key: string) => boolean;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

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

const developmentLimiter = new DevelopmentSubmissionRateLimiter();

export function getSubmissionRateLimiter(): SubmissionRateLimiter | null {
  // An in-memory limiter is safe only for local development. Production must
  // inject a shared implementation backed by Redis or equivalent infrastructure.
  return process.env.NODE_ENV === "production" ? null : developmentLimiter;
}

export const SUBMISSION_RATE_LIMIT_WINDOW_MS = WINDOW_MS;
export const SUBMISSION_RATE_LIMIT_MAX_REQUESTS = MAX_REQUESTS;
