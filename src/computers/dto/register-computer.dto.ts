import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ComputerCapabilitiesDto } from './computer-capabilities.dto';

export class RegisterComputerDto {
  @ApiProperty({ example: 'laptop-001' })
  @IsString()
  hostname: string;

  @ApiProperty({ example: 'abc123...' })
  @IsString()
  connection_token: string;

  @ApiProperty({ type: ComputerCapabilitiesDto })
  @ValidateNested()
  @Type(() => ComputerCapabilitiesDto)
  capabilities: ComputerCapabilitiesDto;
}