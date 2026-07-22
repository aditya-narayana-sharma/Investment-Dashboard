export class RateLimiter {
  private nextSlot = 0;
  private readonly intervalMs: number;

  constructor(requestsPerSecond: number) {
    this.intervalMs = Math.ceil(1000 / requestsPerSecond);
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + this.intervalMs;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
