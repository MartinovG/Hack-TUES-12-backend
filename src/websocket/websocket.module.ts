import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComputerWebSocketGateway } from './websocket.gateway';
import { ComputersModule } from '../computers/computers.module';
import { VirtualMachinesModule } from '../virtual-machines/virtual-machines.module';
import { VMRental } from '../entities/vm-rental.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VMRental]), ComputersModule, VirtualMachinesModule],
  providers: [ComputerWebSocketGateway],
  exports: [ComputerWebSocketGateway],
})
export class WebSocketModule {}
