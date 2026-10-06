import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfig } from '../config/configuration.js';
import { entityGlobs } from './entity-globs.js';

/**
 * Wires TypeORM into the Nest DI container using the same typed config the
 * rest of the app reads through `ConfigService` — no domain entities live
 * here; each domain module registers its own via `TypeOrmModule.forFeature`.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfig, true>): TypeOrmModuleOptions => ({
        type: 'postgres',
        url: configService.get('databaseUrl', { infer: true }),
        ...entityGlobs(import.meta.dirname),
        synchronize: false,
        migrationsRun: false,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
