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
  StreamableFile,
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

    const scriptContent = this.generatePythonScript(vm.id, vm.connectionToken);

    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', `attachment; filename="vm_client_${vm.id}.py"`);
    res.send(scriptContent);
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

  private generatePythonScript(vmId: string, connectionToken: string): string {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    
    return `#!/usr/bin/env python3
"""
VM Client Script for VM Sharing Platform
VM ID: ${vmId}
"""

import requests
import time
import json
import subprocess
import sys
from datetime import datetime

# Configuration
API_URL = "${apiUrl}"
VM_ID = "${vmId}"
CONNECTION_TOKEN = "${connectionToken}"
HEARTBEAT_INTERVAL = 30  # seconds
JOB_POLL_INTERVAL = 10  # seconds

class VMClient:
    def __init__(self):
        self.headers = {
            "Content-Type": "application/json",
        }
    
    def send_heartbeat(self):
        """Send heartbeat to server"""
        try:
            response = requests.post(
                f"{API_URL}/vms/{VM_ID}/heartbeat",
                headers=self.headers
            )
            if response.status_code == 200:
                print(f"[{datetime.now()}] Heartbeat sent successfully")
            else:
                print(f"[{datetime.now()}] Heartbeat failed: {response.status_code}")
        except Exception as e:
            print(f"[{datetime.now()}] Heartbeat error: {e}")
    
    def poll_jobs(self):
        """Check for pending jobs"""
        try:
            response = requests.get(
                f"{API_URL}/vms/{VM_ID}/jobs/pending",
                headers=self.headers
            )
            if response.status_code == 200:
                jobs = response.json()
                for job in jobs:
                    self.execute_job(job)
        except Exception as e:
            print(f"[{datetime.now()}] Job polling error: {e}")
    
    def execute_job(self, job):
        """Execute a job"""
        job_id = job['id']
        job_type = job['jobType']
        job_data = job['jobData']
        
        print(f"[{datetime.now()}] Executing job {job_id} of type {job_type}")
        
        try:
            if job_type == 'command':
                result = subprocess.run(
                    job_data['command'],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                output = result.stdout if result.returncode == 0 else result.stderr
                status = 'completed' if result.returncode == 0 else 'failed'
            
            elif job_type == 'script':
                # Save script to temp file and execute
                with open(f'/tmp/job_{job_id}.py', 'w') as f:
                    f.write(job_data['code'])
                result = subprocess.run(
                    [sys.executable, f'/tmp/job_{job_id}.py'],
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                output = result.stdout if result.returncode == 0 else result.stderr
                status = 'completed' if result.returncode == 0 else 'failed'
            
            elif job_type == 'docker':
                # Execute docker command
                docker_cmd = f"docker run {job_data['image']} {job_data.get('command', '')}"
                result = subprocess.run(
                    docker_cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=600
                )
                output = result.stdout if result.returncode == 0 else result.stderr
                status = 'completed' if result.returncode == 0 else 'failed'
            
            else:
                output = f"Unknown job type: {job_type}"
                status = 'failed'
            
            # Report result
            self.report_job_result(job_id, status, output)
            
        except Exception as e:
            print(f"[{datetime.now()}] Job execution error: {e}")
            self.report_job_result(job_id, 'failed', str(e))
    
    def report_job_result(self, job_id, status, result):
        """Report job execution result"""
        try:
            response = requests.post(
                f"{API_URL}/jobs/{job_id}/result",
                headers=self.headers,
                json={"status": status, "result": result}
            )
            if response.status_code == 200:
                print(f"[{datetime.now()}] Job {job_id} result reported: {status}")
        except Exception as e:
            print(f"[{datetime.now()}] Error reporting job result: {e}")
    
    def run(self):
        """Main loop"""
        print(f"[{datetime.now()}] VM Client started for VM {VM_ID}")
        print(f"[{datetime.now()}] API URL: {API_URL}")
        
        last_heartbeat = 0
        last_job_poll = 0
        
        while True:
            try:
                current_time = time.time()
                
                # Send heartbeat
                if current_time - last_heartbeat >= HEARTBEAT_INTERVAL:
                    self.send_heartbeat()
                    last_heartbeat = current_time
                
                # Poll for jobs
                if current_time - last_job_poll >= JOB_POLL_INTERVAL:
                    self.poll_jobs()
                    last_job_poll = current_time
                
                time.sleep(1)
                
            except KeyboardInterrupt:
                print(f"\\n[{datetime.now()}] VM Client stopped")
                break
            except Exception as e:
                print(f"[{datetime.now()}] Error in main loop: {e}")
                time.sleep(5)

if __name__ == "__main__":
    client = VMClient()
    client.run()
`;
  }
}