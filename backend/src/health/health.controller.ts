import { Controller, Get } from '@nestjs/common';
import { HealthResponseDto } from './dto/health-response.dto.js';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponseDto {
    return { status: 'ok' };
  }
}
