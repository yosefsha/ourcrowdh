import { existsSync } from 'fs';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/configuration.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // `/health` stays unprefixed — it is the ALB health check target.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.enableShutdownHooks();

  const configService = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const staticDir = configService.get('staticDir', { infer: true });
  if (!existsSync(staticDir)) {
    logger.warn(
      `STATIC_DIR "${staticDir}" does not exist — the SPA will not be served until a frontend build is present there.`,
    );
  }

  const port = configService.get('port', { infer: true });
  await app.listen(port);
  logger.log(`Listening on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to bootstrap the application', error);
  process.exit(1);
});
