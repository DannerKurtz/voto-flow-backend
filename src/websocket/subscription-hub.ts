import type { ResultIdentity } from '../repositories/result-repository.js';

type Socket = { send(message: string): void };

export class SubscriptionHub {
  private readonly subscriptions = new Map<string, Set<Socket>>();
  private readonly sockets = new Map<Socket, Set<string>>();

  subscribe(socket: Socket, identity: ResultIdentity): void {
    const topic = this.topic(identity);
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
    for (const socket of this.subscriptions.get(this.topic(identity)) ?? []) socket.send(message);
  }

  private topic(identity: ResultIdentity): string {
    return `${identity.electionCode}:${identity.scopeCode}:${identity.officeCode}`;
  }
}
