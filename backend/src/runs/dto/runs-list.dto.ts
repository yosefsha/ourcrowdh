import { RunDto } from './run.dto.js';

/** Response shape of `GET /api/runs` (`docs/PLAN.md#http-api`). */
export class RunsListDto {
  readonly runs: readonly RunDto[];

  constructor(runs: readonly RunDto[]) {
    this.runs = runs;
  }
}
