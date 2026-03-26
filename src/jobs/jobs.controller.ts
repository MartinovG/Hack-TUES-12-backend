import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobResultDto } from './dto/update-job-result.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('jobs')
@Controller()
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Post('rentals/:rentalId/jobs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload work to execute (receiver)' })
  async create(
    @Param('rentalId') rentalId: string,
    @Body() createJobDto: CreateJobDto,
    @Request() req,
  ) {
    return this.jobsService.create(rentalId, createJobDto, req.user.userId);
  }

  @Get('rentals/:rentalId/jobs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List jobs for a rental' })
  async findByRental(@Param('rentalId') rentalId: string) {
    return this.jobsService.findByRental(rentalId);
  }

  @Get('vms/:vmId/jobs/pending')
  @ApiOperation({ summary: 'Get pending jobs for VM (Python script)' })
  async findPending(@Param('vmId') vmId: string) {
    return this.jobsService.findPendingByVM(vmId);
  }

  @Post('jobs/:jobId/result')
  @ApiOperation({ summary: 'Report job result (Python script)' })
  async updateResult(
    @Param('jobId') jobId: string,
    @Body() updateJobResultDto: UpdateJobResultDto,
  ) {
    return this.jobsService.updateResult(
      jobId,
      updateJobResultDto.status,
      updateJobResultDto.result,
    );
  }
}