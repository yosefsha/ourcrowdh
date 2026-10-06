import { InMemoryNotifier } from './in-memory-notifier.js';

describe('InMemoryNotifier', () => {
  it('records every alert it is asked to send, in order', async () => {
    const notifier = new InMemoryNotifier();
    const first = { runId: 'run-1', generatedAt: new Date('2026-01-01'), mentions: [] };
    const second = { runId: 'run-2', generatedAt: new Date('2026-01-02'), mentions: [] };

    await notifier.notify(first);
    await notifier.notify(second);

    expect(notifier.alerts).toEqual([first, second]);
  });

  it('starts with no alerts recorded', () => {
    const notifier = new InMemoryNotifier();

    expect(notifier.alerts).toEqual([]);
  });
});
