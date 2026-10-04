import { buildApp } from './app.js';
import { loadConfig } from './config.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const app = buildApp({ logger: { level: config.LOG_LEVEL } });

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch (error) {
    app.log.error(error, 'Unable to start server');
    process.exit(1);
  }
}

void start();
