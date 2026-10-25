import { buildApp } from './app.js';
import { loadConfig, loadPollTargets, loadSecondRoundComparisonConfig } from './config.js';
import { createDatabase } from './database.js';
import { ResultPoller } from './polling/result-poller.js';
import { PostgresResultRepository } from './repositories/postgres-result-repository.js';
import { migrate } from './migrate.js';
import { ResultService } from './services/result-service.js';
import { PresidentialComparisonService } from './services/presidential-comparison-service.js';
import { publishSecondRoundComparisonUpdate } from './second-round/publish-update.js';
import { GlobalRequestRateLimiter } from './tse/rate-limiter.js';
import { TseClient } from './tse/tse-client.js';
import { SubscriptionHub } from './websocket/subscription-hub.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const pollTargets = loadPollTargets(process.env.TSE_POLL_TARGETS);
  const secondRoundComparisonConfig = loadSecondRoundComparisonConfig(
    process.env.SECOND_ROUND_COMPARISON_CONFIG,
    pollTargets,
  );
  await migrate();
  const database = createDatabase(config.DATABASE_URL);
  const repository = new PostgresResultRepository(database);
  const subscriptionHub = new SubscriptionHub();
  const presidentialComparisonService = secondRoundComparisonConfig
    ? new PresidentialComparisonService(repository, secondRoundComparisonConfig)
    : undefined;
  const app = buildApp(
    { logger: { level: config.LOG_LEVEL } },
    {
      resultRepository: repository,
      subscriptionHub,
      corsOrigin: config.FRONTEND_ORIGIN,
      presidentialComparisonService,
    },
  );
  const poller = new ResultPoller({
    client: new TseClient({
      timeoutMs: config.TSE_TIMEOUT_MS,
      limiter: new GlobalRequestRateLimiter(config.TSE_MAX_REQUESTS_PER_SECOND),
    }),
    resultService: new ResultService(repository),
    subscriptionHub,
    targets: pollTargets,
    onError: (error, target) => app.log.error({ err: error, target }, 'TSE polling failed'),
    onResultChanged: presidentialComparisonService
      ? (identity) => publishSecondRoundComparisonUpdate(identity, presidentialComparisonService, subscriptionHub)
      : undefined,
  });
  app.addHook('onClose', async () => {
    await poller.stop();
    await database.end();
  });
  const shutdown = () => {
    void app.close().catch((error) => {
      app.log.error(error, 'Unable to close server');
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  app.addHook('onClose', async () => {
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
  });

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
    if (pollTargets.length > 0) poller.start(config.TSE_POLL_INTERVAL_MS);
  } catch (error) {
    app.log.error(error, 'Unable to start server');
    await app.close();
    process.exitCode = 1;
  }
}

void start().catch((error: unknown) => {
  console.error('Unable to initialize server', error);
  process.exitCode = 1;
});
