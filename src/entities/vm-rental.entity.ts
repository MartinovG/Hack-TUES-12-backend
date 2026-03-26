import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { VirtualMachine } from './virtual-machine.entity';
import { User } from './user.entity';
import { VMJob } from './vm-job.entity';
import { VMUsageMetric } from './vm-usage-metric.entity';

export enum RentalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

@Entity('vm_rentals')
export class VMRental {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vm_id' })
  vmId: string;

  @ManyToOne(() => VirtualMachine, (vm) => vm.rentals)
  @JoinColumn({ name: 'vm_id' })
  vm: VirtualMachine;

  @Column({ name: 'receiver_id' })
  receiverId: string;

  @ManyToOne(() => User, (user) => user.rentals)
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCost: number;

  @Column({
    type: 'enum',
    enum: RentalStatus,
    default: RentalStatus.ACTIVE,
  })
  status: RentalStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => VMJob, (job) => job.rental)
  jobs: VMJob[];

  @OneToMany(() => VMUsageMetric, (metric) => metric.rental)
  metrics: VMUsageMetric[];
}