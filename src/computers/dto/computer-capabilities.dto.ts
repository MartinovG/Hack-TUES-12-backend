import { IsString, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ComputerCapabilitiesDto {
  @ApiProperty({ example: 8 })
  @IsNumber()
  @IsPositive()
  cpu_cores: number;

  @ApiProperty({ example: 16 })
  @IsNumber()
  @IsPositive()
  ram_gb: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive()
  storage_gb: number;

  @ApiProperty({ example: 'Windows 11' })
  @IsString()
  os: string;
}