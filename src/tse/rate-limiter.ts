export class GlobalRequestRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxRequestsPerSecond = 10,
    private readonly now: () => number = Date.now,
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    if (!Number.isInteger(maxRequestsPerSecond) || maxRequestsPerSecond < 1 || maxRequestsPerSecond > 10) {
      throw new Error('maxRequestsPerSecond must be an integer between 1 and 10');
    }
  }

  async acquire(): Promise<void> {
    for (;;) {
      const now = this.now();
      this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < 1_000);
      if (this.timestamps.length < this.maxRequestsPerSecond) {
        this.timestamps.push(now);
        return;
      }
      await this.sleep(1_000 - (now - this.timestamps[0]));
    }
  }
}
