import { buildApp } from './app.js';
import { loadConfig, loadPollTargets } from './config.js';
import { createDatabase } from './database.js';
import { ResultPoller } from './polling/result-poller.js';
import { PostgresResultRepository } from './repositories/postgres-result-repository.js';
import { migrate } from './migrate.js';
import { ResultService } from './services/result-service.js';
import { GlobalRequestRateLimiter } from './tse/rate-limiter.js';
import { TseClient } from './tse/tse-client.js';
import { SubscriptionHub } from './websocket/subscription-hub.js';

async function start(): Promise<void> {
  const config = loadConfig();
  await migrate();
  const pollTargets = loadPollTargets(process.env.TSE_POLL_TARGETS);
  const database = createDatabase(config.DATABASE_URL);
  const repository = new PostgresResultRepository(database);
  const subscriptionHub = new SubscriptionHub();
  const app = buildApp(
    { logger: { level: config.LOG_LEVEL } },
    { resultRepository: repository, subscriptionHub, corsOrigin: config.FRONTEND_ORIGIN },
  );
  app.addHook('onClose', async () => database.end());
  const poller = new ResultPoller({
    client: new TseClient({
      timeoutMs: config.TSE_TIMEOUT_MS,
      limiter: new GlobalRequestRateLimiter(config.TSE_MAX_REQUESTS_PER_SECOND),
    }),
    resultService: new ResultService(repository),
    subscriptionHub,
    targets: pollTargets,
    onError: (error) => app.log.error(error, 'TSE polling cycle failed'),
  });
  if (pollTargets.length > 0) {
    poller.start(config.TSE_POLL_INTERVAL_MS);
  }
  app.addHook('onClose', async () => poller.stop());

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch (error) {
    app.log.error(error, 'Unable to start server');
    process.exit(1);
  }
}

void start();
