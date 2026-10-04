import type { FastifyInstance } from 'fastify';

import type { ResultIdentity, ResultRepository } from '../repositories/result-repository.js';

const paramsSchema = {
  type: 'object',
  required: ['electionCode', 'scopeCode', 'officeCode'],
  properties: {
    electionCode: { type: 'string', minLength: 1 },
    scopeCode: { type: 'string', minLength: 1 },
    officeCode: { type: 'string', minLength: 1 },
  },
} as const;

type RouteParams = ResultIdentity;

export async function registerResultRoutes(app: FastifyInstance, repository: ResultRepository): Promise<void> {
  app.get<{ Params: RouteParams }>('/results/:electionCode/:scopeCode/:officeCode', {
    schema: {
      tags: ['Results'],
      summary: 'Get the current official result document stored by Voto Flow',
      params: paramsSchema,
      response: { 404: { type: 'object', properties: { message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const document = await repository.getCurrent(request.params);
    if (!document) return reply.code(404).send({ message: 'Result not found' });
    return document;
  });

  app.get<{ Params: RouteParams }>('/results/:electionCode/:scopeCode/:officeCode/snapshots', {
    schema: {
      tags: ['Results'],
      summary: 'Get result snapshots from newest to oldest',
      params: paramsSchema,
    },
  }, async (request) => repository.listSnapshots(request.params));
}
