import type { ResultIdentity } from '../repositories/result-repository.js';
import type { ResultService, ResultSource } from '../services/result-service.js';
import type { TseClient } from '../tse/tse-client.js';
import type { SubscriptionHub } from '../websocket/subscription-hub.js';

export type PollTarget = ResultSource;

export type PollSummary = {
  checked: number;
  changed: number;
  notModified: number;
};

export class ResultPoller {
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly options: {
    client: TseClient;
    resultService: ResultService;
    subscriptionHub: SubscriptionHub;
    targets: PollTarget[];
    onError?: (error: unknown) => void;
  }) {}

  async runOnce(): Promise<PollSummary> {
    const summary: PollSummary = { checked: 0, changed: 0, notModified: 0 };
    for (const target of this.options.targets) {
      summary.checked += 1;
      const current = await this.options.resultService.current(target);
      const response = await this.options.client.getJson({
        url: target.sourceUrl,
        etag: current?.etag,
        lastModified: current?.lastModified,
      });
      if (response.status === 'not-modified') {
        summary.notModified += 1;
        continue;
      }
      const stored = await this.options.resultService.record(target, response.rawPayload, response.payload, {
        etag: response.etag,
        lastModified: response.lastModified,
      });
      if (stored.changed) {
        summary.changed += 1;
        this.options.subscriptionHub.publish(this.identity(target), stored.document.sourcePayload);
      }
    }
    return summary;
  }

  start(intervalMs: number): void {
    if (this.timer) return;
    const schedule = async (): Promise<void> => {
      try {
        await this.runOnce();
      } catch (error) {
        this.options.onError?.(error);
      } finally {
        this.timer = setTimeout(schedule, intervalMs);
      }
    };
    void schedule();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private identity(target: PollTarget): ResultIdentity {
    return {
      electionCode: target.electionCode,
      scopeCode: target.scopeCode,
      officeCode: target.officeCode,
    };
  }
}
