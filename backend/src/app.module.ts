import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import configuration from './config/configuration.js';
import { AppConfig } from './config/configuration.js';
import { validationSchema } from './config/validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';

// Routes the SPA catch-all must never swallow — they stay reachable by the
// controllers registered elsewhere in this module.
const API_AND_HEALTH_ROUTES = ['/api/{*splat}', '/health', '/health/{*splat}'];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // `validationSchema` is a Joi schema, which `@nestjs/config` validates
      // through the Standard Schema protocol (https://standardschema.dev/).
      // For Joi schemas specifically it defaults `abortEarly: false` and
      // `allowUnknown: true` — exactly what an env schema that only
      // constrains a handful of keys needs — so no `validationOptions`
      // override is required here.
      validationSchema,
    }),
    ServeStaticModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfig, true>) => [
        {
          rootPath: configService.get('staticDir', { infer: true }),
          exclude: API_AND_HEALTH_ROUTES,
        },
      ],
      inject: [ConfigService],
    }),
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}
