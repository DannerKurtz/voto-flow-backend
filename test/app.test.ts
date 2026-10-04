import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { InMemoryResultRepository } from '../src/repositories/result-repository.js';
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
