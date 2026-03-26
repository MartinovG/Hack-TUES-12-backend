import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { VMRental } from './vm-rental.entity';

@Entity('vm_usage_metrics')
export class VMUsageMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rental_id' })
  rentalId: string;

  @ManyToOne(() => VMRental, (rental) => rental.metrics)
  @JoinColumn({ name: 'rental_id' })
  rental: VMRental;

  @Column({ name: 'cpu_usage_percent', type: 'decimal', precision: 5, scale: 2 })
  cpuUsagePercent: number;

  @Column({ name: 'ram_usage_gb', type: 'decimal', precision: 10, scale: 2 })
  ramUsageGb: number;

  @Column({ name: 'gpu_usage_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  gpuUsagePercent: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}