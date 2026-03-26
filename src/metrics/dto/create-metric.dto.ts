import { IsNotEmpty, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMetricDto {
  @ApiProperty({ example: 45.5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  cpuUsagePercent: number;

  @ApiProperty({ example: 8.2 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  ramUsageGb: number;

  @ApiProperty({ example: 60.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  gpuUsagePercent?: number;
}