import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { VMRental } from './vm-rental.entity';

export enum VMStatus {
  AVAILABLE = 'available',
  RUNNING = 'running',
  SETUP = 'setup',
  MAINTENANCE = 'maintenance',
  OFFLINE = 'offline',
}

@Entity('virtual_machines')
export class VirtualMachine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => User, (user) => user.providedVMs)
  @JoinColumn({ name: 'provider_id' })
  provider: User;

  @Column()
  name: string;

  @Column({ name: 'cpu_cores', type: 'int' })
  cpuCores: number;

  @Column({ name: 'cpu_model' })
  cpuModel: string;

  @Column({ name: 'cpu_frequency_ghz', type: 'decimal', precision: 5, scale: 2 })
  cpuFrequencyGhz: number;

  @Column({ name: 'gpu_model', nullable: true })
  gpuModel: string;

  @Column({ name: 'gpu_vram_gb', type: 'int', nullable: true })
  gpuVramGb: number;

  @Column({ name: 'ram_gb', type: 'int' })
  ramGb: number;

  @Column({ name: 'storage_gb', type: 'int' })
  storageGb: number;

  @Column()
  os: string;

  @Column({ name: 'connection_token', unique: true })
  connectionToken: string;

  @Column({
    type: 'enum',
    enum: VMStatus,
    default: VMStatus.OFFLINE,
  })
  status: VMStatus;

  @Column({ name: 'price_per_hour', type: 'decimal', precision: 10, scale: 2 })
  pricePerHour: number;

  @Column({ name: 'last_heartbeat', type: 'timestamp', nullable: true })
  lastHeartbeat: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => VMRental, (rental) => rental.vm)
  rentals: VMRental[];
}