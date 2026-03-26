import {
  Controller,
  Get,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { CreateMetricDto } from './dto/create-metric.dto';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Post('rental/:rentalId')
  @ApiOperation({ summary: 'Record usage metric (Python script)' })
  async create(
    @Param('rentalId') rentalId: string,
    @Body() createMetricDto: CreateMetricDto,
  ) {
    return this.metricsService.create(rentalId, createMetricDto);
  }

  @Get('rental/:rentalId')
  @ApiOperation({ summary: 'Get metrics for a rental' })
  async findByRental(@Param('rentalId') rentalId: string) {
    return this.metricsService.findByRental(rentalId);
  }
}