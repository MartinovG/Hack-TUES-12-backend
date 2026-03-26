import { Injectable } from '@nestjs/common';
import { CalculateRequirementsDto } from './dto/calculate-requirements.dto';

@Injectable()
export class CalculatorService {
  calculate(dto: CalculateRequirementsDto) {
    const baseRequirements = this.getBaseRequirements(dto.workloadType);
    const intensityMultiplier = this.getIntensityMultiplier(dto.intensity);

    const recommendedCpu = Math.ceil(baseRequirements.cpu * intensityMultiplier);
    const recommendedRam = Math.ceil(baseRequirements.ram * intensityMultiplier);
    const recommendedStorage = Math.ceil(baseRequirements.storage * intensityMultiplier);

    return {
      workloadType: dto.workloadType,
      intensity: dto.intensity,
      hoursPerDay: dto.hoursPerDay,
      recommendations: {
        minCpuCores: recommendedCpu,
        minRamGb: recommendedRam,
        minStorageGb: recommendedStorage,
        requiresGpu: dto.requiresGpu || baseRequirements.requiresGpu,
        estimatedCostPerDay: this.estimateCost(dto.hoursPerDay, recommendedCpu, recommendedRam),
      },
      description: this.getDescription(dto.workloadType, dto.intensity),
    };
  }

  private getBaseRequirements(workloadType: string) {
    const requirements = {
      'video-editing': { cpu: 8, ram: 16, storage: 500, requiresGpu: true },
      '3d-rendering': { cpu: 12, ram: 32, storage: 1000, requiresGpu: true },
      'machine-learning': { cpu: 16, ram: 64, storage: 500, requiresGpu: true },
      'web-development': { cpu: 4, ram: 8, storage: 100, requiresGpu: false },
      'data-processing': { cpu: 8, ram: 32, storage: 500, requiresGpu: false },
    };

    return requirements[workloadType] || { cpu: 4, ram: 8, storage: 100, requiresGpu: false };
  }

  private getIntensityMultiplier(intensity: string): number {
    const multipliers = {
      low: 0.7,
      medium: 1.0,
      high: 1.5,
    };

    return multipliers[intensity] || 1.0;
  }

  private estimateCost(hoursPerDay: number, cpu: number, ram: number): number {
    // Simple cost estimation: $0.50 per CPU core + $0.20 per GB RAM per hour
    const hourlyRate = cpu * 0.5 + ram * 0.2;
    return Math.round(hourlyRate * hoursPerDay * 100) / 100;
  }

  private getDescription(workloadType: string, intensity: string): string {
    return `For ${workloadType} with ${intensity} intensity, you'll need a powerful machine to handle the workload efficiently.`;
  }
}