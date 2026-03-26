import { IsNotEmpty, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JobType } from '../../entities/vm-job.entity';

export class CreateJobDto {
  @ApiProperty({ enum: JobType, example: JobType.COMMAND })
  @IsNotEmpty()
  @IsEnum(JobType)
  jobType: JobType;

  @ApiProperty({
    example: { command: 'echo "Hello World"' },
    description: 'Job data - structure depends on job type',
  })
  @IsNotEmpty()
  @IsObject()
  jobData: any;
}