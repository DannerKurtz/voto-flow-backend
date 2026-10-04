import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { registerHealthRoute } from './routes/health.js';
import { registerResultRoutes } from './routes/results.js';
import { registerWebsocketRoutes } from './routes/websocket.js';
import type { ResultRepository } from './repositories/result-repository.js';
import { SubscriptionHub } from './websocket/subscription-hub.js';

type AppDependencies = { resultRepository?: ResultRepository; subscriptionHub?: SubscriptionHub };

export function buildApp(options: FastifyServerOptions = {}, dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify(options);

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Voto Flow API',
        description: 'Backend API for official Brazilian 2026 general-election results.',
        version: '0.1.0',
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/documentation',
  });

  app.register(registerHealthRoute);
  if (dependencies.resultRepository) {
    app.register(registerResultRoutes, dependencies.resultRepository);
  }
  if (dependencies.subscriptionHub) {
    app.register(registerWebsocketRoutes, dependencies.subscriptionHub);
  }

  return app;
}
