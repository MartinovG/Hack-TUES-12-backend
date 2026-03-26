import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VirtualMachine } from './virtual-machine.entity';
import { VMRental } from './vm-rental.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => VirtualMachine, (vm) => vm.provider)
  providedVMs: VirtualMachine[];

  @OneToMany(() => VMRental, (rental) => rental.receiver)
  rentals: VMRental[];
}