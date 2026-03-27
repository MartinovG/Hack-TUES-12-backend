import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VMJob, JobStatus } from '../entities/vm-job.entity';
import { RentalsService } from '../rentals/rentals.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ComputerWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(VMJob)
    private jobRepository: Repository<VMJob>,
    private rentalsService: RentalsService,
    private websocketGateway: ComputerWebSocketGateway,
  ) {}

  async create(rentalId: string, createJobDto: CreateJobDto, userId: string): Promise<VMJob> {
    const rental = await this.rentalsService.findOne(rentalId);

    if (rental.receiverId !== userId) {
      throw new BadRequestException('You can only create jobs for your own rentals');
    }

    const command = createJobDto.jobData?.command?.trim();

    if (createJobDto.jobType === 'command' && !command) {
      throw new BadRequestException('Command cannot be empty');
    }

    const job = this.jobRepository.create({
      rentalId,
      ...createJobDto,
      status: JobStatus.PENDING,
    });

    const savedJob = await this.jobRepository.save(job);

    if (
      createJobDto.jobType === 'command' &&
      rental.vm?.physicalComputerId &&
      command
    ) {
      const script = `#!/usr/bin/env bash\nset -e\n${command}\n`;
      const execFilename = `job-${savedJob.id}.sh`;
      const wasDispatched = await this.websocketGateway.sendExecuteFile(
        rental.vm.physicalComputerId,
        {
          action: 'execute_file',
          vm_id: rental.vmId,
          job_id: savedJob.id,
          exec_file: Buffer.from(script, 'utf-8').toString('base64'),
          exec_filename: execFilename,
          exec_command: `bash /home/vagrant/${execFilename}`,
          working_directory: '/home/vagrant',
          timeout: 300,
        },
      );

      if (!wasDispatched) {
        savedJob.status = JobStatus.FAILED;
        savedJob.result = 'Provider machine is not connected right now';
        return await this.jobRepository.save(savedJob);
      }
    }

    return savedJob;
  }

  async findByRental(rentalId: string): Promise<VMJob[]> {
    return await this.jobRepository.find({
      where: { rentalId },
      order: { createdAt: 'DESC' },
    });
  }

  async findPendingByVM(vmId: string): Promise<VMJob[]> {
    return await this.jobRepository
      .createQueryBuilder('job')
      .innerJoin('job.rental', 'rental')
      .where('rental.vmId = :vmId', { vmId })
      .andWhere('job.status = :status', { status: JobStatus.PENDING })
      .getMany();
  }

  async updateResult(jobId: string, status: JobStatus, result: string): Promise<VMJob> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    job.status = status;
    job.result = result;

    return await this.jobRepository.save(job);
  }

  async findOne(id: string): Promise<VMJob> {
    const job = await this.jobRepository.findOne({
      where: { id },
      relations: ['rental'],
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }
}
