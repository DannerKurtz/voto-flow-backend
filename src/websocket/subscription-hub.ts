import type { ResultIdentity } from '../repositories/result-repository.js';

type Socket = { readonly readyState?: number; send(message: string): void };

export class SubscriptionHub {
  private readonly subscriptions = new Map<string, Set<Socket>>();
  private readonly sockets = new Map<Socket, Set<string>>();

  subscribe(socket: Socket, identity: ResultIdentity): void {
    this.subscribeToTopic(socket, this.topic(identity));
  }

  subscribeSecondRoundComparison(socket: Socket, scopeCode: string): void {
    this.subscribeToTopic(socket, this.secondRoundComparisonTopic(scopeCode));
  }

  subscribeSecondRoundGovernor(socket: Socket, scopeCode: string): void {
    this.subscribeToTopic(socket, this.secondRoundGovernorTopic(scopeCode));
  }

  publishSecondRoundComparison(scopeCode: string, comparison: unknown): void {
    const message = JSON.stringify({
      type: 'second-round.comparison.updated',
      data: { scopeCode, comparison },
    });
    this.broadcast(this.secondRoundComparisonTopic(scopeCode), message);
  }

  publishSecondRoundGovernor(scopeCode: string, result: unknown): void {
    const message = JSON.stringify({
      type: 'second-round.governor.updated',
      data: { scopeCode, result },
    });
    this.broadcast(this.secondRoundGovernorTopic(scopeCode), message);
  }

  private subscribeToTopic(socket: Socket, topic: string): void {
    const subscribers = this.subscriptions.get(topic) ?? new Set<Socket>();
    subscribers.add(socket);
    this.subscriptions.set(topic, subscribers);
    const topics = this.sockets.get(socket) ?? new Set<string>();
    topics.add(topic);
    this.sockets.set(socket, topics);
  }

  unsubscribeAll(socket: Socket): void {
    for (const topic of this.sockets.get(socket) ?? []) {
      const subscribers = this.subscriptions.get(topic);
      subscribers?.delete(socket);
      if (subscribers?.size === 0) this.subscriptions.delete(topic);
    }
    this.sockets.delete(socket);
  }

  publish(identity: ResultIdentity, sourcePayload: unknown): void {
    const message = JSON.stringify({ type: 'result.updated', data: { ...identity, sourcePayload } });
    this.broadcast(this.topic(identity), message);
  }

  private broadcast(topic: string, message: string): void {
    for (const socket of this.subscriptions.get(topic) ?? []) {
      try {
        if (socket.readyState !== undefined && socket.readyState !== 1) {
          this.unsubscribeAll(socket);
          continue;
        }
        socket.send(message);
      } catch {
        this.unsubscribeAll(socket);
      }
    }
  }

  private topic(identity: ResultIdentity): string {
    return `${identity.electionCode}:${identity.scopeCode}:${identity.officeCode}`;
  }

  private secondRoundComparisonTopic(scopeCode: string): string {
    return `second-round-comparison:${scopeCode}`;
  }

  private secondRoundGovernorTopic(scopeCode: string): string {
    return `second-round-governor:${scopeCode}`;
  }
}
