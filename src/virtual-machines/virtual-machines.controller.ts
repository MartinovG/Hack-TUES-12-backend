import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VirtualMachinesService } from './virtual-machines.service';
import { CreateVMDto } from './dto/create-vm.dto';
import { UpdateVMStatusDto } from './dto/update-vm-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VMStatus } from '../entities/virtual-machine.entity';
import { Response } from 'express';

@ApiTags('virtual-machines')
@Controller('vms')
export class VirtualMachinesController {
  constructor(private virtualMachinesService: VirtualMachinesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new VM (provider)' })
  async create(@Body() createVMDto: CreateVMDto, @Request() req) {
    return this.virtualMachinesService.create(createVMDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all VMs with optional filters' })
  @ApiQuery({ name: 'minCpu', required: false, type: Number })
  @ApiQuery({ name: 'minRam', required: false, type: Number })
  @ApiQuery({ name: 'minStorage', required: false, type: Number })
  @ApiQuery({ name: 'hasGpu', required: false, type: Boolean })
  @ApiQuery({ name: 'status', required: false, enum: VMStatus })
  async findAll(
    @Query('minCpu') minCpu?: number,
    @Query('minRam') minRam?: number,
    @Query('minStorage') minStorage?: number,
    @Query('hasGpu') hasGpu?: boolean,
    @Query('status') status?: VMStatus,
  ) {
    return this.virtualMachinesService.findAll({
      minCpu: minCpu ? Number(minCpu) : undefined,
      minRam: minRam ? Number(minRam) : undefined,
      minStorage: minStorage ? Number(minStorage) : undefined,
      hasGpu: hasGpu === true || String(hasGpu) === 'true',
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get VM details' })
  async findOne(@Param('id') id: string) {
    return this.virtualMachinesService.findOne(id);
  }

  @Get(':id/download-script')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download Python client script for VM' })
  async downloadScript(@Param('id') id: string, @Request() req, @Res() res: Response) {
    const vm = await this.virtualMachinesService.findOne(id);

    if (vm.providerId !== req.user.userId) {
      throw new Error('You can only download script for your own VMs');
    }

    return res.redirect('/download/python');
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update VM status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateVMStatusDto: UpdateVMStatusDto,
    @Request() req,
  ) {
    return this.virtualMachinesService.updateStatus(
      id,
      updateVMStatusDto.status,
      req.user.userId,
    );
  }

  @Post(':id/heartbeat')
  @ApiOperation({ summary: 'VM heartbeat (Python script)' })
  async heartbeat(@Param('id') id: string) {
    await this.virtualMachinesService.updateHeartbeat(id);
    return { message: 'Heartbeat received' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete VM' })
  async remove(@Param('id') id: string, @Request() req) {
    await this.virtualMachinesService.delete(id, req.user.userId);
    return { message: 'VM deleted successfully' };
  }
}
