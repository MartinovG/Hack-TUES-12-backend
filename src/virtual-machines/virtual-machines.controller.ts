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
import type { Request as ExpressRequest, Response } from 'express';
import { DownloadService } from '../download/download.service';

type AuthenticatedRequest = ExpressRequest & {
  user: {
    userId: string;
  };
};

@ApiTags('virtual-machines')
@Controller('vms')
export class VirtualMachinesController {
  constructor(
    private virtualMachinesService: VirtualMachinesService,
    private readonly downloadService: DownloadService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new VM (provider)' })
  async create(@Body() createVMDto: CreateVMDto, @Request() req: AuthenticatedRequest) {
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
  @ApiOperation({ summary: 'Download raw Python client bundle for VM' })
  async downloadScript(@Param('id') id: string, @Request() req: AuthenticatedRequest, @Res() res: Response) {
    const vm = await this.virtualMachinesService.findOne(id);

    if (vm.providerId !== req.user.userId) {
      throw new Error('You can only download script for your own VMs');
    }

    return res.redirect('/download/python');
  }

  @Get(':id/download-connector')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download connector bundle with prefilled setup key for VM' })
  async downloadConnector(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const vm = await this.virtualMachinesService.findOne(id);

    if (vm.providerId !== req.user.userId) {
      throw new Error('You can only download connector for your own VMs');
    }

    const bundle = this.downloadService.buildConnectorBundle({
      backendUrl: this.resolveBackendUrl(req),
      connectionToken: vm.connectionToken,
      vmId: vm.id,
      vmName: vm.name,
    });

    if (!bundle) {
      res.status(404).json({ message: 'Connector bundle was not found on server' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
    return bundle.file;
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update VM status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateVMStatusDto: UpdateVMStatusDto,
    @Request() req: AuthenticatedRequest,
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
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await this.virtualMachinesService.delete(id, req.user.userId);
    return { message: 'VM deleted successfully' };
  }

  private resolveBackendUrl(req: ExpressRequest) {
    const configured = process.env.HIVE_PUBLIC_BACKEND_URL?.trim();
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    return `${proto}://${req.get('host')}`;
  }
}
