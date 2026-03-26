import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VirtualMachinesService } from './virtual-machines.service';
import { VirtualMachinesController } from './virtual-machines.controller';
import { VirtualMachine } from '../entities/virtual-machine.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VirtualMachine])],
  controllers: [VirtualMachinesController],
  providers: [VirtualMachinesService],
  exports: [VirtualMachinesService],
})
export class VirtualMachinesModule {}