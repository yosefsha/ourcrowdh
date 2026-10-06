import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Query shape of `GET /api/runs?limit=` (`docs/PLAN.md#http-api`): limit is
 * 1–50, defaulting to 10. `@Type(() => Number)` runs before the validators
 * so `limit=abc` fails `@IsInt()` rather than silently passing through as a
 * string, and `limit=0` fails `@Min(1)` — both 400, per the global
 * `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).
 */
export class ListRunsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}
