import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VirtualMachinesService } from './virtual-machines.service';
import { VirtualMachinesController } from './virtual-machines.controller';
import { VirtualMachine } from '../entities/virtual-machine.entity';
import { DownloadModule } from '../download/download.module';

@Module({
  imports: [TypeOrmModule.forFeature([VirtualMachine]), DownloadModule],
  controllers: [VirtualMachinesController],
  providers: [VirtualMachinesService],
  exports: [VirtualMachinesService],
})
export class VirtualMachinesModule {}
