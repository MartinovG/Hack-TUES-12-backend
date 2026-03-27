import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ComputersService } from '../computers/computers.service';
import { VirtualMachinesService } from '../virtual-machines/virtual-machines.service';
import { ComputerStatus } from '../entities/physical-computer.entity';
import { VMStatus } from '../entities/virtual-machine.entity';
import {
  ClientConnectedEvent,
  VMProvisioningStartedEvent,
  VMProvisionedEvent,
  VMProvisioningFailedEvent,
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  VMStoppedEvent,
  VMDestroyedEvent,
  HeartbeatEvent,
  VMMetricsEvent,
  ErrorOccurredEvent,
  ProvisionVMEvent,
  ExecuteFileEvent,
  StopVMEvent,
  DestroyVMEvent,
  ConnectionAcknowledgedEvent,
} from './dto/websocket-events.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  path: '/computer-socket',
})
export class ComputerWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ComputerWebSocketGateway.name);
  private connectedClients: Map<
    string,
    { socket: Socket; computerId: string; hostname: string }
  > = new Map();

  constructor(
    private computersService: ComputersService,
    private vmService: VirtualMachinesService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client attempting to connect: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Find and remove the computer from connected clients
    for (const [socketId, data] of this.connectedClients.entries()) {
      if (socketId === client.id) {
        await this.computersService.setConnected(data.computerId, false);
        this.connectedClients.delete(socketId);
        this.logger.log(`Computer ${data.hostname} marked as disconnected`);
        break;
      }
    }
  }

  // ============ CONNECTION & REGISTRATION ============

  @SubscribeMessage('client_connected')
  async handleClientConnected(
    @MessageBody() data: ClientConnectedEvent,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Computer connecting: ${data.hostname}`);

    try {
      // Register or update computer
      const computer = await this.computersService.register({
        hostname: data.hostname,
        connection_token: data.connection_token,
        capabilities: data.capabilities,
      });

      // Store in connected clients map
      this.connectedClients.set(client.id, {
        socket: client,
        computerId: computer.id,
        hostname: computer.hostname,
      });

      // Send acknowledgment
      const response: ConnectionAcknowledgedEvent = {
        action: 'connection_acknowledged',
        computer_id: computer.id,
        status: 'available',
        message: 'Successfully registered and connected',
      };

      client.emit('connection_acknowledged', response);
      this.logger.log(`Computer ${data.hostname} registered with ID: ${computer.id}`);
    } catch (error) {
      this.logger.error(`Failed to register computer: ${error.message}`);
      client.emit('error', { message: 'Failed to register computer' });
    }
  }

  // ============ VM PROVISIONING ============

  @SubscribeMessage('vm_provisioning_started')
  async handleVMProvisioningStarted(
    @MessageBody() data: VMProvisioningStartedEvent,
  ) {
    this.logger.log(`VM provisioning started: ${data.vm_id}`);

    try {
      await this.vmService.updateStatus(data.vm_id, VMStatus.BUILDING, 'system');
    } catch (error) {
      this.logger.error(`Failed to update VM status: ${error.message}`);
    }
  }

  @SubscribeMessage('vm_provisioned')
  async handleVMProvisioned(@MessageBody() data: VMProvisionedEvent) {
    this.logger.log(`VM provisioned successfully: ${data.vm_id}`);

    try {
      const vm = await this.vmService.findOne(data.vm_id);
      
      // Update VM with SSH info
      await this.vmService.updateStatus(data.vm_id, VMStatus.RUNNING, 'system');
      
      // Update computer status
      if (vm.physicalComputerId) {
        await this.computersService.updateStatus(
          vm.physicalComputerId,
          ComputerStatus.ACTIVE,
        );
      }

      this.logger.log(`VM ${data.vm_id} is now running at ${data.vm_info.ip_address}`);
    } catch (error) {
      this.logger.error(`Failed to update VM info: ${error.message}`);
    }
  }

  @SubscribeMessage('vm_provisioning_failed')
  async handleVMProvisioningFailed(@MessageBody() data: VMProvisioningFailedEvent) {
    this.logger.error(`VM provisioning failed: ${data.vm_id} - ${data.error}`);

    try {
      const vm = await this.vmService.findOne(data.vm_id);
      await this.vmService.updateStatus(data.vm_id, VMStatus.OFFLINE, 'system');

      // Free up the computer
      if (vm.physicalComputerId) {
        await this.computersService.updateStatus(
          vm.physicalComputerId,
          ComputerStatus.AVAILABLE,
        );
        await this.computersService.setCurrentVM(vm.physicalComputerId, null);
      }
    } catch (error) {
      this.logger.error(`Failed to handle provisioning failure: ${error.message}`);
    }
  }

  // ============ EXECUTION ============

  @SubscribeMessage('execution_started')
  async handleExecutionStarted(@MessageBody() data: ExecutionStartedEvent) {
    this.logger.log(`Execution started: Job ${data.job_id}`);
    // Job status update handled by JobsService
  }

  @SubscribeMessage('execution_completed')
  async handleExecutionCompleted(@MessageBody() data: ExecutionCompletedEvent) {
    this.logger.log(`Execution completed: Job ${data.job_id}`);
    // Emit event for JobsService to handle
    this.server.emit('job_completed', data);
  }

  @SubscribeMessage('execution_failed')
  async handleExecutionFailed(@MessageBody() data: ExecutionFailedEvent) {
    this.logger.error(`Execution failed: Job ${data.job_id} - ${data.error}`);
    // Emit event for JobsService to handle
    this.server.emit('job_failed', data);
  }

  // ============ VM LIFECYCLE ============

  @SubscribeMessage('vm_stopped')
  async handleVMStopped(@MessageBody() data: VMStoppedEvent) {
    this.logger.log(`VM stopped: ${data.vm_id}`);
    // Status update handled externally
  }

  @SubscribeMessage('vm_destroyed')
  async handleVMDestroyed(@MessageBody() data: VMDestroyedEvent) {
    this.logger.log(`VM destroyed: ${data.vm_id}`);

    try {
      const vm = await this.vmService.findOne(data.vm_id);
      await this.vmService.updateStatus(data.vm_id, VMStatus.OFFLINE, 'system');

      // Free up the computer
      if (vm.physicalComputerId) {
        await this.computersService.updateStatus(
          vm.physicalComputerId,
          ComputerStatus.AVAILABLE,
        );
        await this.computersService.setCurrentVM(vm.physicalComputerId, null);
      }
    } catch (error) {
      this.logger.error(`Failed to handle VM destruction: ${error.message}`);
    }
  }

  // ============ MONITORING ============

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @MessageBody() data: HeartbeatEvent,
    @ConnectedSocket() client: Socket,
  ) {
    const clientData = this.connectedClients.get(client.id);
    if (clientData) {
      await this.computersService.updateHeartbeat(clientData.computerId);
    }
  }

  @SubscribeMessage('vm_metrics')
  async handleVMMetrics(@MessageBody() data: VMMetricsEvent) {
    // Store metrics - can be handled by MetricsService
    this.server.emit('metrics_received', data);
  }

  @SubscribeMessage('error_occurred')
  async handleError(@MessageBody() data: ErrorOccurredEvent) {
    this.logger.error(`Error from client: ${data.error_type} - ${data.message}`);
  }

  // ============ SERVER → CLIENT METHODS ============

  async sendProvisionVM(computerId: string, event: ProvisionVMEvent): Promise<boolean> {
    for (const [socketId, clientData] of this.connectedClients.entries()) {
      if (clientData.computerId === computerId) {
        clientData.socket.emit('provision_vm', event);
        this.logger.log(`Sent provision_vm to computer ${clientData.hostname}`);
        return true;
      }
    }
    this.logger.warn(`Computer ${computerId} not found in connected clients`);
    return false;
  }

  async sendExecuteFile(computerId: string, event: ExecuteFileEvent): Promise<boolean> {
    for (const [socketId, clientData] of this.connectedClients.entries()) {
      if (clientData.computerId === computerId) {
        clientData.socket.emit('execute_file', event);
        this.logger.log(`Sent execute_file to computer ${clientData.hostname}`);
        return true;
      }
    }
    this.logger.warn(`Computer ${computerId} not found in connected clients`);
    return false;
  }

  async sendStopVM(computerId: string, event: StopVMEvent): Promise<boolean> {
    for (const [socketId, clientData] of this.connectedClients.entries()) {
      if (clientData.computerId === computerId) {
        clientData.socket.emit('stop_vm', event);
        this.logger.log(`Sent stop_vm to computer ${clientData.hostname}`);
        return true;
      }
    }
    return false;
  }

  async sendDestroyVM(computerId: string, event: DestroyVMEvent): Promise<boolean> {
    for (const [socketId, clientData] of this.connectedClients.entries()) {
      if (clientData.computerId === computerId) {
        clientData.socket.emit('destroy_vm', event);
        this.logger.log(`Sent destroy_vm to computer ${clientData.hostname}`);
        return true;
      }
    }
    return false;
  }

  getConnectedComputersCount(): number {
    return this.connectedClients.size;
  }

  isComputerConnected(computerId: string): boolean {
    for (const clientData of this.connectedClients.values()) {
      if (clientData.computerId === computerId) {
        return true;
      }
    }
    return false;
  }
}
