import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertsModule } from '../alerts/alerts.module.js';
import { Notifier, NOTIFIER } from '../alerts/notifier.js';
import { ClassificationModule } from '../classification/classification.module.js';
import { MentionClassifier, MENTION_CLASSIFIER } from '../classification/mention-classifier.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { CompanyRepository, COMPANY_REPOSITORY } from '../companies/company.repository.js';
import { AppConfig } from '../config/configuration.js';
import { MentionsModule } from '../mentions/mentions.module.js';
import { MentionWriter, MENTION_WRITER } from '../mentions/mention-writer.js';
import { NewsModule } from '../news/news.module.js';
import { NewsSource, NEWS_SOURCE } from '../news/news-source.js';
import { PostgresRunRepository } from './repositories/postgres-run.repository.js';
import { RunRepository, RUN_REPOSITORY } from './run.repository.js';
import { RunService } from './run.service.js';

/**
 * Providers shared between `RunsModule` (the HTTP-facing module `AppModule`
 * imports) and `RunCliModule` (what `CliModule` imports for `cli run`) —
 * factored out so the two application contexts bind `RunService` and
 * `RUN_REPOSITORY` identically without duplicating the wiring. The
 * scheduler is deliberately *not* here: it belongs only to the HTTP app
 * (see `runs.module.ts`) — registering a cron job inside a one-shot CLI
 * invocation would keep the process alive after `cli run` finishes.
 */
export const runRepositoryProvider: Provider = {
  provide: RUN_REPOSITORY,
  useClass: PostgresRunRepository,
};

export const runServiceProvider: Provider = {
  provide: RunService,
  useFactory: (
    companyRepository: CompanyRepository,
    newsSource: NewsSource,
    classifier: MentionClassifier,
    mentionWriter: MentionWriter,
    runRepository: RunRepository,
    notifier: Notifier,
    config: ConfigService<AppConfig, true>,
  ): RunService =>
    new RunService(
      companyRepository,
      newsSource,
      classifier,
      mentionWriter,
      runRepository,
      notifier,
      config.get('backfillDays', { infer: true }),
      config.get('alertWindowHours', { infer: true }),
    ),
  inject: [
    COMPANY_REPOSITORY,
    NEWS_SOURCE,
    MENTION_CLASSIFIER,
    MENTION_WRITER,
    RUN_REPOSITORY,
    NOTIFIER,
    ConfigService,
  ],
};

/**
 * Modules a consumer of `RunService` must import to resolve the ports it
 * depends on — every port *except* `RUN_REPOSITORY` (bound locally by
 * `runRepositoryProvider`, since this is the module that owns `runs/`) and
 * `MENTION_WRITER` (bound by `MentionsModule`, also owned by this issue).
 * Shared between `RunsModule` and `RunCliModule` so both application
 * contexts see the same port graph.
 */
export const runPortImports = [
  CompaniesModule,
  NewsModule,
  ClassificationModule,
  AlertsModule,
  MentionsModule,
];
