import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VMUsageMetric } from '../entities/vm-usage-metric.entity';
import { CreateMetricDto } from './dto/create-metric.dto';

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(VMUsageMetric)
    private metricRepository: Repository<VMUsageMetric>,
  ) {}

  async create(rentalId: string, createMetricDto: CreateMetricDto): Promise<VMUsageMetric> {
    const metric = this.metricRepository.create({
      rentalId,
      ...createMetricDto,
      timestamp: new Date(),
    });

    return await this.metricRepository.save(metric);
  }

  async findByRental(rentalId: string): Promise<VMUsageMetric[]> {
    return await this.metricRepository.find({
      where: { rentalId },
      order: { timestamp: 'DESC' },
      take: 100, // Last 100 metrics
    });
  }
}