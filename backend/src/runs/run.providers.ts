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
import { unboundPortStandIn } from './unbound-port-stand-in.js';

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
  // `COMPANY_REPOSITORY`, `NEWS_SOURCE`, `MENTION_CLASSIFIER` and `NOTIFIER`
  // are injected as *optional* and backed by `unboundPortStandIn` when
  // absent — see that file's doc comment for why: those four ports are
  // bound by other, separately developed feature issues that may not have
  // landed on `main` yet, and this module must still let the app boot.
  useFactory: (
    companyRepository: CompanyRepository | undefined,
    newsSource: NewsSource | undefined,
    classifier: MentionClassifier | undefined,
    mentionWriter: MentionWriter,
    runRepository: RunRepository,
    notifier: Notifier | undefined,
    config: ConfigService<AppConfig, true>,
  ): RunService =>
    new RunService(
      companyRepository ?? unboundPortStandIn<CompanyRepository>('COMPANY_REPOSITORY'),
      newsSource ?? unboundPortStandIn<NewsSource>('NEWS_SOURCE'),
      classifier ?? unboundPortStandIn<MentionClassifier>('MENTION_CLASSIFIER'),
      mentionWriter,
      runRepository,
      notifier ?? unboundPortStandIn<Notifier>('NOTIFIER'),
      config.get('backfillDays', { infer: true }),
      config.get('alertWindowHours', { infer: true }),
    ),
  inject: [
    { token: COMPANY_REPOSITORY, optional: true },
    { token: NEWS_SOURCE, optional: true },
    { token: MENTION_CLASSIFIER, optional: true },
    MENTION_WRITER,
    RUN_REPOSITORY,
    { token: NOTIFIER, optional: true },
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
