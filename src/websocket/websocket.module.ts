import { Module } from '@nestjs/common';
import { ComputerWebSocketGateway } from './websocket.gateway';
import { ComputersModule } from '../computers/computers.module';
import { VirtualMachinesModule } from '../virtual-machines/virtual-machines.module';

@Module({
  imports: [ComputersModule, VirtualMachinesModule],
  providers: [ComputerWebSocketGateway],
  exports: [ComputerWebSocketGateway],
})
export class WebSocketModule {}