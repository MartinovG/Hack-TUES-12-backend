import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VMRental } from './vm-rental.entity';

export enum JobType {
  SCRIPT = 'script',
  DOCKER = 'docker',
  COMMAND = 'command',
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('vm_jobs')
export class VMJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rental_id' })
  rentalId: string;

  @ManyToOne(() => VMRental, (rental) => rental.jobs)
  @JoinColumn({ name: 'rental_id' })
  rental: VMRental;

  @Column({
    name: 'job_type',
    type: 'enum',
    enum: JobType,
  })
  jobType: JobType;

  @Column({ name: 'job_data', type: 'jsonb' })
  jobData: any;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({ type: 'text', nullable: true })
  result: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}