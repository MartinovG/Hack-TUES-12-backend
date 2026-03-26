import { IsNotEmpty, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '../../entities/vm-job.entity';

export class UpdateJobResultDto {
  @ApiProperty({ enum: JobStatus, example: JobStatus.COMPLETED })
  @IsNotEmpty()
  @IsEnum(JobStatus)
  status: JobStatus;

  @ApiProperty({ example: 'Job completed successfully' })
  @IsNotEmpty()
  @IsString()
  result: string;
}