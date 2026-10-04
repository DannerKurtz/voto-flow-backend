import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { SubscriptionHub } from '../websocket/subscription-hub.js';

const subscribeMessageSchema = z.object({
  type: z.literal('subscribe'),
  electionCode: z.string().min(1),
  scopeCode: z.string().min(1),
  officeCode: z.string().min(1),
});

export async function registerWebsocketRoutes(app: FastifyInstance, hub: SubscriptionHub): Promise<void> {
  await app.register(websocket);
  app.get('/ws', { websocket: true }, (socket) => {
    socket.on('message', (message) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.toString());
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'Message must be valid JSON' }));
        return;
      }
      const subscription = subscribeMessageSchema.safeParse(parsed);
      if (!subscription.success) {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid subscription message' }));
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
