import { Alert, Notifier } from './notifier.js';

/**
 * In-memory fake for `Notifier`. Records every Alert it was asked to send
 * so a test can assert on what the Run orchestrator sent, instead of
 * mocking a console or HTTP client.
 */
export class InMemoryNotifier implements Notifier {
  private readonly sentAlerts: Alert[] = [];

  async notify(alert: Alert): Promise<void> {
    this.sentAlerts.push(alert);
    return Promise.resolve();
  }

  get alerts(): readonly Alert[] {
    return this.sentAlerts;
  }
}
