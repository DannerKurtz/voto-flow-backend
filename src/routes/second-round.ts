import type { FastifyInstance } from 'fastify';

import type { PresidentialComparisonService } from '../services/presidential-comparison-service.js';
import type { GovernorResultsService } from '../services/governor-results-service.js';

const errorResponse = { type: 'object', properties: { message: { type: 'string' } } } as const;
const candidateSchema = {
  type: 'object',
  required: ['key', 'sqcand', 'name', 'ballotName', 'votes', 'percentage'],
  properties: {
    key: { type: 'string' },
    sqcand: { type: 'string' },
    name: { type: 'string' },
    ballotName: { type: 'string' },
    votes: { type: 'number' },
    percentage: { type: 'number' },
  },
} as const;
const officialCandidateSchema = {
  type: 'object',
  required: ['sqcand', 'name', 'ballotName', 'votes', 'percentage'],
  properties: {
    sqcand: { type: 'string' }, name: { type: 'string' }, ballotName: { type: 'string' },
    votes: { type: 'number' }, percentage: { type: 'number' },
  },
} as const;
const comparisonSchema = {
  type: 'object',
  required: ['scope', 'availability', 'firstRound', 'secondRound', 'estimatedSurplus'],
  properties: {
    scope: {
      type: 'object',
      required: ['code', 'level'],
      properties: { code: { type: 'string' }, level: { type: 'string', enum: ['national', 'state'] } },
    },
    availability: { type: 'string', enum: ['pending', 'ready'] },
    firstRound: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          required: ['electionCode', 'totalizationPercentage', 'candidates'],
          properties: {
            electionCode: { type: 'string' },
            totalizationPercentage: { type: 'number' },
            candidates: { type: 'array', items: candidateSchema },
          },
        },
      ],
    },
    secondRound: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          required: ['electionCode', 'totalizationPercentage', 'blankVotes', 'nullVotes', 'candidates'],
          properties: {
            electionCode: { type: 'string' },
            totalizationPercentage: { type: 'number' },
            blankVotes: { type: 'number' },
            nullVotes: { type: 'number' },
            candidates: { type: 'array', items: candidateSchema },
          },
        },
      ],
    },
    estimatedSurplus: {
      type: 'object',
      required: ['estimated', 'eligible', 'label', 'candidates'],
      properties: {
        estimated: { type: 'boolean', const: true },
        eligible: { type: 'boolean' },
        label: { type: 'string' },
        candidates: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'votes'],
            properties: { key: { type: 'string' }, votes: { anyOf: [{ type: 'number' }, { type: 'null' }] } },
          },
        },
      },
    },
  },
} as const;

export async function registerSecondRoundRoutes(
  app: FastifyInstance,
  dependencies: {
    presidentialComparisonService?: Pick<PresidentialComparisonService, 'list' | 'current'>;
    governorResultsService?: Pick<GovernorResultsService, 'list' | 'current'>;
  },
): Promise<void> {
  const service = dependencies.presidentialComparisonService;
  const governorService = dependencies.governorResultsService;
  if (service) {
    app.get('/results/second-round/president', {
      schema: {
        tags: ['Second round'],
        summary: 'List configured presidential first- and second-round comparisons',
        response: {
          200: {
            type: 'object',
            required: ['results'],
            properties: { results: { type: 'array', items: comparisonSchema } },
          },
        },
      },
    }, async () => ({ results: await service.list() }));

    app.get<{ Params: { scopeCode: string } }>('/results/second-round/president/:scopeCode', {
      schema: {
        tags: ['Second round'],
        summary: 'Get a presidential first- and second-round comparison for Brazil or one state',
        params: {
          type: 'object',
          required: ['scopeCode'],
          properties: { scopeCode: { type: 'string', minLength: 1 } },
        },
        response: { 200: comparisonSchema, 404: errorResponse },
      },
    }, async (request, reply) => {
      const comparison = await service.current(request.params.scopeCode);
      if (!comparison) return reply.code(404).send({ message: 'Comparison scope not found' });
      return comparison;
    });
  }

  if (governorService) {
    const governorResultSchema = {
      type: 'object',
      required: ['scope', 'availability', 'secondRound'],
      properties: {
        scope: { type: 'object', required: ['code', 'level'], properties: { code: { type: 'string' }, level: { type: 'string', const: 'state' } } },
        availability: { type: 'string', enum: ['pending', 'ready'] },
        secondRound: {
          anyOf: [{ type: 'null' }, {
            type: 'object', required: ['electionCode', 'totalizationPercentage', 'blankVotes', 'nullVotes', 'candidates'],
            properties: {
              electionCode: { type: 'string' }, totalizationPercentage: { type: 'number' },
              blankVotes: { type: 'number' }, nullVotes: { type: 'number' },
              candidates: { type: 'array', items: officialCandidateSchema },
            },
          }],
        },
      },
    } as const;
    app.get('/results/second-round/governors', {
      schema: {
        tags: ['Second round'],
        summary: 'List configured state governor runoff results',
        response: { 200: { type: 'object', required: ['results'], properties: { results: { type: 'array', items: governorResultSchema } } } },
      },
    }, async () => ({ results: await governorService.list() }));
    app.get<{ Params: { scopeCode: string } }>('/results/second-round/governors/:scopeCode', {
      schema: {
        tags: ['Second round'],
        summary: 'Get one configured governor runoff result',
        params: { type: 'object', required: ['scopeCode'], properties: { scopeCode: { type: 'string', minLength: 1 } } },
        response: { 200: governorResultSchema, 404: errorResponse },
      },
    }, async (request, reply) => {
      const result = await governorService.current(request.params.scopeCode);
      if (!result) return reply.code(404).send({ message: 'Governor result scope not found' });
      return result;
    });
  }
}
