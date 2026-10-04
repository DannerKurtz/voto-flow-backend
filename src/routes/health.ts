import type { FastifyInstance } from 'fastify';

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Check whether the API is running',
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['status'],
            properties: {
              status: { type: 'string', enum: ['ok'] },
            },
          },
        },
      },
    },
    async () => ({ status: 'ok' }),
  );
}
