import { IsNotEmpty, IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVMDto {
  @ApiProperty({ example: 'My Gaming PC' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 8 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  cpuCores: number;

  @ApiProperty({ example: 'Intel Core i7-12700K' })
  @IsNotEmpty()
  @IsString()
  cpuModel: string;

  @ApiProperty({ example: 3.6 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.1)
  cpuFrequencyGhz: number;

  @ApiProperty({ example: 'NVIDIA RTX 3080', required: false })
  @IsOptional()
  @IsString()
  gpuModel?: string;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  gpuVramGb?: number;

  @ApiProperty({ example: 16 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  ramGb: number;

  @ApiProperty({ example: 500 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  storageGb: number;

  @ApiProperty({ example: 'Windows 11' })
  @IsNotEmpty()
  @IsString()
  os: string;

  @ApiProperty({ example: 5.50 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  pricePerHour: number;
}