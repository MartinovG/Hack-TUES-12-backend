import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VirtualMachine } from './virtual-machine.entity';

export enum ComputerStatus {
  CONNECTED = 'connected',
  AVAILABLE = 'available',
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  OFFLINE = 'offline',
}

@Entity('physical_computers')
export class PhysicalComputer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hostname: string;

  @Column({ name: 'connection_token', unique: true })
  connectionToken: string;

  @Column({ name: 'is_connected', default: false })
  isConnected: boolean;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({
    type: 'enum',
    enum: ComputerStatus,
    default: ComputerStatus.OFFLINE,
  })
  status: ComputerStatus;

  @Column({ name: 'cpu_cores', type: 'int' })
  cpuCores: number;

  @Column({ name: 'ram_gb', type: 'int' })
  ramGb: number;

  @Column({ name: 'storage_gb', type: 'int' })
  storageGb: number;

  @Column({ name: 'host_os' })
  hostOs: string;

  @Column({ name: 'current_vm_id', nullable: true })
  currentVmId: string;

  @Column({ name: 'last_heartbeat', type: 'timestamp', nullable: true })
  lastHeartbeat: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => VirtualMachine, (vm) => vm.physicalComputer)
  virtualMachines: VirtualMachine[];
}