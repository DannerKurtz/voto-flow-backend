import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { registerHealthRoute } from './routes/health.js';

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
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

  return app;
}
