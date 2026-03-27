import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ComputersService } from './computers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('computers')
@Controller('computers')
export class ComputersController {
  constructor(private computersService: ComputersService) {}

  @Get()
  @ApiOperation({ summary: 'List all computers' })
  async findAll() {
    return this.computersService.findAll();
  }

  @Get('available')
  @ApiOperation({ summary: 'List available computers' })
  @ApiQuery({ name: 'minCpu', required: false, type: Number })
  @ApiQuery({ name: 'minRam', required: false, type: Number })
  @ApiQuery({ name: 'minStorage', required: false, type: Number })
  async findAvailable(
    @Query('minCpu') minCpu?: number,
    @Query('minRam') minRam?: number,
    @Query('minStorage') minStorage?: number,
  ) {
    return this.computersService.findAvailable({
      minCpu: minCpu ? Number(minCpu) : undefined,
      minRam: minRam ? Number(minRam) : undefined,
      minStorage: minStorage ? Number(minStorage) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get computer details' })
  async findOne(@Param('id') id: string) {
    return this.computersService.findOne(id);
  }

  @Post('generate-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a new connection token for a computer' })
  async generateToken() {
    const token = await this.computersService.generateConnectionToken();
    return { connectionToken: token };
  }
}