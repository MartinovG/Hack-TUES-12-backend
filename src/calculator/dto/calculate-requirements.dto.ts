import { IsNotEmpty, IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculateRequirementsDto {
  @ApiProperty({ example: 'video-editing', description: 'Type of work: video-editing, 3d-rendering, machine-learning, web-development, data-processing' })
  @IsNotEmpty()
  @IsString()
  workloadType: string;

  @ApiProperty({ example: 5, description: 'Number of hours per day' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  hoursPerDay: number;

  @ApiProperty({ example: 'high', description: 'Intensity: low, medium, high' })
  @IsNotEmpty()
  @IsString()
  intensity: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  requiresGpu?: boolean;
}