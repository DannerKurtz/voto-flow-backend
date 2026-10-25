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
  private active = false;
  private stopping = false;
  private generation = 0;
  private inFlight: Promise<PollSummary> | undefined;

  constructor(private readonly options: {
    client: Pick<TseClient, 'getJson'>;
    resultService: Pick<ResultService, 'current' | 'record'>;
    subscriptionHub: Pick<SubscriptionHub, 'publish'>;
    targets: PollTarget[];
    onError?: (error: unknown, target?: PollTarget) => void;
    onResultChanged?: (identity: ResultIdentity) => void | Promise<void>;
  }) {}

  runOnce(): Promise<PollSummary> {
    if (this.inFlight) return this.inFlight;
    this.stopping = false;
    const cycle = this.pollTargets();
    this.inFlight = cycle;
    const clear = () => { this.inFlight = undefined; };
    void cycle.then(clear, clear);
    return cycle;
  }

  private async pollTargets(): Promise<PollSummary> {
    const summary: PollSummary = { checked: 0, changed: 0, notModified: 0 };
    for (const target of this.options.targets) {
      if (this.stopping) break;
      summary.checked += 1;
      try {
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
          const identity = this.identity(target);
          this.options.subscriptionHub.publish(identity, stored.document.sourcePayload);
          await this.options.onResultChanged?.(identity);
        }
      } catch (error) {
        if (!this.options.onError) throw error;
        this.options.onError(error, target);
      }
    }
    return summary;
  }

  start(intervalMs: number): void {
    if (this.active) return;
    this.active = true;
    const generation = ++this.generation;
    const schedule = async (): Promise<void> => {
      try {
        await this.runOnce();
      } catch (error) {
        this.options.onError?.(error);
      } finally {
        if (this.active && generation === this.generation) this.timer = setTimeout(schedule, intervalMs);
      }
    };
    void schedule();
  }

  async stop(): Promise<void> {
    this.active = false;
    this.stopping = true;
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    await this.inFlight?.catch(() => undefined);
  }

  private identity(target: PollTarget): ResultIdentity {
    return {
      electionCode: target.electionCode,
      scopeCode: target.scopeCode,
      officeCode: target.officeCode,
    };
  }
}
