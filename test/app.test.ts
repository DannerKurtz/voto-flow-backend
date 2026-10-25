import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import type { SecondRoundComparisonConfig } from '../src/config.js';
import { InMemoryResultRepository } from '../src/repositories/in-memory-result-repository.js';
import { PresidentialComparisonService } from '../src/services/presidential-comparison-service.js';
import { GovernorResultsService } from '../src/services/governor-results-service.js';
import { ResultService } from '../src/services/result-service.js';

const apps: Array<ReturnType<typeof buildApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('GET /health', () => {
  it('returns the running service status', async () => {
    const app = buildApp({ logger: false });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const app = buildApp({ logger: false }, { corsOrigin: 'http://localhost:3001' });
    apps.push(app);

    const response = await app.inject({ method: 'OPTIONS', url: '/health', headers: { origin: 'http://localhost:3001', 'access-control-request-method': 'GET' } });

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
  });
});

describe('GET /results/:electionCode/:scopeCode/:officeCode', () => {
  it('returns the current persisted official result', async () => {
    const repository = new InMemoryResultRepository();
    await new ResultService(repository).record(
      {
        electionCode: '21270',
        officeCode: '0001',
        scopeCode: 'br',
        sourceUrl: 'https://resultados.example/ea20.json',
      },
      '{"totalizado":"10"}',
      { totalizado: '10' },
    );
    const app = buildApp({ logger: false }, { resultRepository: repository });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/results/21270/br/0001' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      electionCode: '21270',
      officeCode: '0001',
      scopeCode: 'br',
      sourcePayload: { totalizado: '10' },
    });
  });

  it('returns snapshots from newest to oldest', async () => {
    const repository = new InMemoryResultRepository();
    const service = new ResultService(repository);
    const source = {
      electionCode: '21270', officeCode: '0001', scopeCode: 'br',
      sourceUrl: 'https://resultados.example/ea20.json',
    };
    await service.record(source, '{"totalizado":"10"}', { totalizado: '10' });
    await service.record(source, '{"totalizado":"20"}', { totalizado: '20' });
    const app = buildApp({ logger: false }, { resultRepository: repository });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/results/21270/br/0001/snapshots' });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((snapshot: { sourcePayload: unknown }) => snapshot.sourcePayload)).toEqual([
      { totalizado: '20' }, { totalizado: '10' },
    ]);
  });
});

const comparisonConfig: SecondRoundComparisonConfig = {
  firstRound: { electionCode: 'first', officeCode: '0001' },
  secondRound: { electionCode: 'second', officeCode: '0001' },
  scopes: ['br', 'sp'],
  candidates: [
    { key: 'flavio', firstRoundSqcand: '100', secondRoundSqcand: '200' },
    { key: 'lula', firstRoundSqcand: '300', secondRoundSqcand: '400' },
  ],
};

const comparisonPayload = (candidates: Array<{ sqcand: string; votes: string }>) => ({
  s: { pst: '20,00', ts: '100', st: '20' },
  v: { vb: '10', vn: '20' },
  carg: [{ agr: [{ par: [{ sg: 'TESTE', cand: candidates.map((candidate) => ({
    sqcand: candidate.sqcand,
    nm: candidate.sqcand,
    nmu: candidate.sqcand,
    vap: candidate.votes,
    pvap: '50,00',
  })) }] }] }],
});

describe('second-round presidential comparison endpoints', () => {
  it('returns the normalized comparison for a configured state', async () => {
    const repository = new InMemoryResultRepository();
    const resultService = new ResultService(repository);
    await resultService.record(
      { electionCode: 'first', scopeCode: 'sp', officeCode: '0001', sourceUrl: 'https://example.com/first-sp' },
      'first-sp', comparisonPayload([{ sqcand: '100', votes: '100' }, { sqcand: '300', votes: '120' }]),
    );
    await resultService.record(
      { electionCode: 'second', scopeCode: 'sp', officeCode: '0001', sourceUrl: 'https://example.com/second-sp' },
      'second-sp', comparisonPayload([{ sqcand: '200', votes: '130' }, { sqcand: '400', votes: '140' }]),
    );
    const comparisonService = new PresidentialComparisonService(repository, comparisonConfig);
    const app = buildApp({ logger: false }, { resultRepository: repository, presidentialComparisonService: comparisonService });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/results/second-round/president/sp' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      availability: 'ready',
      scope: { code: 'sp', level: 'state' },
      secondRound: { blankVotes: 10, nullVotes: 20, sections: { total: 100, totalized: 20 }, candidates: [{ party: 'TESTE' }, { party: 'TESTE' }] },
      estimatedSurplus: { estimated: true, eligible: true },
    });
  });

  it('lists the configured national and state comparisons, including pending scopes', async () => {
    const repository = new InMemoryResultRepository();
    const comparisonService = new PresidentialComparisonService(repository, comparisonConfig);
    const app = buildApp({ logger: false }, { resultRepository: repository, presidentialComparisonService: comparisonService });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/results/second-round/president' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      results: [
        expect.objectContaining({ scope: { code: 'br', level: 'national' }, availability: 'pending' }),
        expect.objectContaining({ scope: { code: 'sp', level: 'state' }, availability: 'pending' }),
      ],
    });
  });

  it('returns 404 for a comparison scope outside the configuration', async () => {
    const repository = new InMemoryResultRepository();
    const comparisonService = new PresidentialComparisonService(repository, comparisonConfig);
    const app = buildApp({ logger: false }, { resultRepository: repository, presidentialComparisonService: comparisonService });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/results/second-round/president/ac' });

    expect(response.statusCode).toBe(404);
  });

  it('documents the new comparison endpoints in OpenAPI', async () => {
    const comparisonService = new PresidentialComparisonService(new InMemoryResultRepository(), comparisonConfig);
    const app = buildApp({ logger: false }, { presidentialComparisonService: comparisonService });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/documentation/json' });
    const specification = response.json() as { paths: Record<string, unknown> };

    expect(specification.paths).toHaveProperty('/results/second-round/president');
    expect(specification.paths).toHaveProperty('/results/second-round/president/{scopeCode}');
  });
});

describe('second-round governor results endpoint', () => {
  it('lists configured governor states with normalized results and pending states', async () => {
    const repository = new InMemoryResultRepository();
    await new ResultService(repository).record({
      electionCode: 'runoff', scopeCode: 'ac', officeCode: 'governor', sourceUrl: 'https://example.com/ac',
    }, 'ac', comparisonPayload([{ sqcand: '10', votes: '150' }, { sqcand: '20', votes: '100' }]));
    const service = new GovernorResultsService(repository, [
      { electionCode: 'runoff', scopeCode: 'ac', officeCode: 'governor' },
      { electionCode: 'runoff', scopeCode: 'df', officeCode: 'governor' },
    ]);
    const app = buildApp({ logger: false }, { governorResultsService: service });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/results/second-round/governors' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ results: [
      { scope: { code: 'ac' }, availability: 'ready', secondRound: { candidates: [{ votes: 150, party: 'TESTE' }, { votes: 100, party: 'TESTE' }] } },
      { scope: { code: 'df' }, availability: 'pending', secondRound: null },
    ] });
  });

  it('adds the governor endpoint to OpenAPI', async () => {
    const service = new GovernorResultsService(new InMemoryResultRepository(), [
      { electionCode: 'runoff', scopeCode: 'ac', officeCode: 'governor' },
    ]);
    const app = buildApp({ logger: false }, { governorResultsService: service });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/documentation/json' });
    expect(response.json().paths).toHaveProperty('/results/second-round/governors');
    expect(response.json().paths).toHaveProperty('/results/second-round/governors/{scopeCode}');
  });
});
