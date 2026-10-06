/**
 * Response shape of `GET /health`. Not request input, so no class-validator
 * decorators — but still a class, consistent with every other response shape
 * in this codebase.
 */
export class HealthResponseDto {
  readonly status = 'ok' as const;
}
