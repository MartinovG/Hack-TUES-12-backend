import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { VMUsageMetric } from '../entities/vm-usage-metric.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VMUsageMetric])],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}