import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { SubscriptionHub } from '../websocket/subscription-hub.js';

const subscribeMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe'),
    electionCode: z.string().min(1),
    scopeCode: z.string().min(1),
    officeCode: z.string().min(1),
  }),
  z.object({
    type: z.literal('subscribe.second-round-comparison'),
    scopeCode: z.string().min(1),
  }),
  z.object({
    type: z.literal('subscribe.second-round-governor'),
    scopeCode: z.string().min(1),
  }),
]);

export function parseSubscriptionMessage(message: string) {
  try {
    return subscribeMessageSchema.safeParse(JSON.parse(message));
  } catch {
    return { success: false as const };
  }
}

export async function registerWebsocketRoutes(app: FastifyInstance, hub: SubscriptionHub): Promise<void> {
  await app.register(websocket);
  app.get('/ws', { websocket: true }, (socket) => {
    socket.on('message', (message) => {
      const subscription = parseSubscriptionMessage(message.toString());
      if (!subscription.success) {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid subscription message' }));
        return;
      }
      if (subscription.data.type === 'subscribe.second-round-comparison') {
        hub.subscribeSecondRoundComparison(socket, subscription.data.scopeCode);
        socket.send(JSON.stringify({
          type: 'subscribed',
          data: { subscription: 'second-round-comparison', scopeCode: subscription.data.scopeCode },
        }));
        return;
      }
      if (subscription.data.type === 'subscribe.second-round-governor') {
        hub.subscribeSecondRoundGovernor(socket, subscription.data.scopeCode);
        socket.send(JSON.stringify({
          type: 'subscribed',
          data: { subscription: 'second-round-governor', scopeCode: subscription.data.scopeCode },
        }));
        return;
      }
      const { electionCode, scopeCode, officeCode } = subscription.data;
      hub.subscribe(socket, { electionCode, scopeCode, officeCode });
      socket.send(JSON.stringify({ type: 'subscribed', data: { electionCode, scopeCode, officeCode } }));
    });
    socket.on('close', () => hub.unsubscribeAll(socket));
    socket.on('error', () => hub.unsubscribeAll(socket));
  });
}
