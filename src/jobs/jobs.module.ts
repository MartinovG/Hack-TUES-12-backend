import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { VMJob } from '../entities/vm-job.entity';
import { RentalsModule } from '../rentals/rentals.module';
import { VirtualMachinesModule } from '../virtual-machines/virtual-machines.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VMJob]),
    RentalsModule,
    VirtualMachinesModule,
    WebSocketModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
