import {
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ListRunsQueryDto } from './dto/list-runs-query.dto.js';
import { RunDto } from './dto/run.dto.js';
import { RunsListDto } from './dto/runs-list.dto.js';
import { RunAlreadyInProgressError } from './run.repository.js';
import { RunService } from './run.service.js';

/**
 * `docs/PLAN.md#http-api`. Thin: validates (via the DTOs and the global
 * `ValidationPipe`), delegates to `RunService`, maps to a response DTO. The
 * 409 mapping is the only decision made here — everything else is
 * `RunService`'s.
 */
@Controller('runs')
export class RunsController {
  constructor(private readonly runService: RunService) {}

  @Get()
  async list(@Query() query: ListRunsQueryDto): Promise<RunsListDto> {
    const runs = await this.runService.list(query.limit);
    return new RunsListDto(runs.map((run) => new RunDto(run)));
  }

  /** Starts a Run in the background and answers 202 immediately; 409 while one is already running. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async trigger(): Promise<RunDto> {
    try {
      const run = await this.runService.startInBackground('manual');
      return new RunDto(run);
    } catch (error) {
      if (error instanceof RunAlreadyInProgressError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
