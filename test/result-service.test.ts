import { describe, expect, it } from 'vitest';

import { InMemoryResultRepository } from '../src/repositories/result-repository.js';
import { ResultService } from '../src/services/result-service.js';

describe('ResultService', () => {
  it('creates a snapshot only when an official document changes', async () => {
    const repository = new InMemoryResultRepository();
    const service = new ResultService(repository);
    const identity = {
      electionCode: '21270',
      officeCode: '0001',
      scopeCode: 'br',
      sourceUrl: 'https://resultados.example/ea20.json',
    };

    const first = await service.record(identity, '{"totalizado":"10"}', { etapa: 'first' });
    const repeated = await service.record(identity, '{"totalizado":"10"}', { etapa: 'first' });
    const changed = await service.record(identity, '{"totalizado":"20"}', { etapa: 'second' });

    expect(first.changed).toBe(true);
    expect(repeated.changed).toBe(false);
    expect(changed.changed).toBe(true);
    expect((await repository.listSnapshots(identity)).map((snapshot) => snapshot.sourcePayload)).toEqual([
      { etapa: 'second' },
      { etapa: 'first' },
    ]);
  });
});
