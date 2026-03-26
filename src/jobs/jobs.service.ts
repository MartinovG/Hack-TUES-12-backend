import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VMJob, JobStatus } from '../entities/vm-job.entity';
import { RentalsService } from '../rentals/rentals.service';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(VMJob)
    private jobRepository: Repository<VMJob>,
    private rentalsService: RentalsService,
  ) {}

  async create(rentalId: string, createJobDto: CreateJobDto, userId: string): Promise<VMJob> {
    const rental = await this.rentalsService.findOne(rentalId);

    if (rental.receiverId !== userId) {
      throw new BadRequestException('You can only create jobs for your own rentals');
    }

    const job = this.jobRepository.create({
      rentalId,
      ...createJobDto,
      status: JobStatus.PENDING,
    });

    return await this.jobRepository.save(job);
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