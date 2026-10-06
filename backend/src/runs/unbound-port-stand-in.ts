/**
 * A stand-in bound to a port's injection token only when nothing else is.
 *
 * Four of the six ports `RunService` depends on (`COMPANY_REPOSITORY`,
 * `NEWS_SOURCE`, `MENTION_CLASSIFIER`, `NOTIFIER`) are owned and bound by
 * other, separately developed feature issues (seed loader, news source,
 * Ollama classifier, console notifier — `docs/PLAN.md#file-ownership`).
 * Those issues are built in parallel with this one and may not have landed
 * on `main` yet, so at any given time one or more of those tokens can have
 * no provider at all.
 *
 * `run.providers.ts` injects all four as *optional*, and substitutes this
 * stand-in whenever Nest resolves one to `undefined`. Every method on it
 * throws the same clear, named error instead of being left `undefined` —
 * so `RunsModule`/`RunCliModule`, and everything else `AppModule` serves
 * alongside them (`/health`, the dashboard, export), still boot. Only an
 * actual Run attempt fails, with a message naming the missing adapter,
 * instead of every other feature being taken down by a raw
 * `UnknownDependenciesException` at process start.
 *
 * Once the owning issue lands and binds the real provider, Nest injects
 * that real instance instead — nothing here changes or needs removing.
 */
export function unboundPortStandIn<T extends object>(portName: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      // Every port method is async, so this rejects rather than throws
      // synchronously — a caller that does `somePort.method().catch(...)`
      // without a surrounding try/catch (the normal shape for an async
      // port) still observes the failure the same way it would a real
      // adapter's own rejected Promise.
      return () =>
        Promise.reject(
          new Error(
            `RunService cannot proceed: no adapter is bound for ${portName} (property ` +
              `"${String(property)}") — its owning feature issue has not landed on main yet.`,
          ),
        );
    },
  });
}
