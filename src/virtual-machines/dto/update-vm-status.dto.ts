import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VMStatus } from '../../entities/virtual-machine.entity';

export class UpdateVMStatusDto {
  @ApiProperty({ enum: VMStatus, example: VMStatus.AVAILABLE })
  @IsEnum(VMStatus)
  status: VMStatus;
}