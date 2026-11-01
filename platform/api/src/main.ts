import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  createCsrfOriginGuard,
  createLogger,
  loadConfig,
  requestContextMiddleware,
  securityHeadersMiddleware,
} from '@h-os/kernel';
import { AppModule } from './app.module.js';

/**
 * Process entry point. Configuration is validated before the HTTP server starts so a
 * misconfigured deployment fails fast instead of serving with defaults (STK-003).
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  const logger = createLogger(config.logLevel, 'h-os-api');

  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    logger: ['error', 'warn', 'log'],
    bodyParser: true,
  });

  // Every request gets a request ID and trace ID before any handler runs (LOG-004).
  app.use(requestContextMiddleware);
  // Baseline secure headers, and cross-origin state-changing requests must be allowlisted
  // (SEC-011). SameSite cookies cover form CSRF; this closes the remaining cross-site call paths.
  app.use(securityHeadersMiddleware);
  app.use(createCsrfOriginGuard(config));

  app.enableCors({
    origin: config.corsOrigins.length > 0 ? [...config.corsOrigins] : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.disable('x-powered-by');
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');

  logger.info({
    event: 'api.started',
    port: config.port,
    nodeEnv: config.nodeEnv,
    organization: config.organization.code,
  });
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`${JSON.stringify({ event: 'api.start_failed', message })}\n`);
  process.exitCode = 1;
});
