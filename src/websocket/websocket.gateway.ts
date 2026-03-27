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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComputersService } from '../computers/computers.service';
import { VirtualMachinesService } from '../virtual-machines/virtual-machines.service';
import { ComputerStatus } from '../entities/physical-computer.entity';
import { VMStatus } from '../entities/virtual-machine.entity';
import { VMRental, RentalState } from '../entities/vm-rental.entity';
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
    { socket: Socket; computerId: string; hostname: string; vmId: string }
  > = new Map();

  constructor(
    private computersService: ComputersService,
    private vmService: VirtualMachinesService,
    @InjectRepository(VMRental)
    private rentalRepository: Repository<VMRental>,
  ) {}

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client attempting to connect: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Find and remove the computer from connected clients
    for (const [socketId, data] of this.connectedClients.entries()) {
      if (socketId === client.id) {
        await this.computersService.setConnected(data.computerId, false);
        const vm = await this.vmService.findOne(data.vmId);
        const nextStatus =
          vm.status === VMStatus.RUNNING || vm.status === VMStatus.BUILDING
            ? VMStatus.OFFLINE
            : vm.status === VMStatus.SHUTTING_DOWN
              ? VMStatus.OFFLINE
              : vm.status;
        await this.vmService.updateStatus(data.vmId, nextStatus, 'system');
        await this.closeActiveRentalForVm(
          data.vmId,
          'Provider machine disconnected before the rental completed',
        );
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
      const vm = await this.vmService.findByConnectionToken(data.connection_token);

      // Register or update computer
      const computer = await this.computersService.register({
        hostname: data.hostname,
        connection_token: data.connection_token,
        capabilities: data.capabilities,
      });

      await this.vmService.setPhysicalComputer(vm.id, computer.id);
      await this.computersService.setCurrentVM(computer.id, vm.id);

      if ([VMStatus.CONFIGURING, VMStatus.OFFLINE, VMStatus.FAILED].includes(vm.status)) {
        await this.vmService.updateStatus(vm.id, VMStatus.AVAILABLE, 'system');
      }

      // Store in connected clients map
      this.connectedClients.set(client.id, {
        socket: client,
        computerId: computer.id,
        hostname: computer.hostname,
        vmId: vm.id,
      });

      // Send acknowledgment
      const response: ConnectionAcknowledgedEvent = {
        action: 'connection_acknowledged',
        computer_id: computer.id,
        vm_id: vm.id,
        status:
          vm.status === VMStatus.RUNNING || vm.status === VMStatus.BUILDING
            ? vm.status
            : 'available',
        message: 'Provider machine registered. This VM can now be used.',
      };

      client.emit('connection_acknowledged', response);
      this.logger.log(`Computer ${data.hostname} registered with ID: ${computer.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to register computer: ${this.getErrorMessage(error)}`,
      );
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
      this.logger.error(
        `Failed to update VM status: ${this.getErrorMessage(error)}`,
      );
    }
  }

  @SubscribeMessage('vm_provisioned')
  async handleVMProvisioned(@MessageBody() data: VMProvisionedEvent) {
    this.logger.log(`VM provisioned successfully: ${data.vm_id}`);

    try {
      const vm = await this.vmService.findOne(data.vm_id);

      await this.vmService.updateVMInfo(data.vm_id, {
        ipAddress: data.vm_info.ip_address,
        sshPort: data.vm_info.ssh_port,
        sshUsername: data.vm_info.ssh_username,
      });

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
      this.logger.error(`Failed to update VM info: ${this.getErrorMessage(error)}`);
    }
  }

  @SubscribeMessage('vm_provisioning_failed')
  async handleVMProvisioningFailed(@MessageBody() data: VMProvisioningFailedEvent) {
    this.logger.error(`VM provisioning failed: ${data.vm_id} - ${data.error}`);

    try {
      this.logger.warn(`Marking VM ${data.vm_id} as failed after provisioning error`);
      const vm = await this.vmService.findOne(data.vm_id);
      await this.vmService.updateStatus(data.vm_id, VMStatus.FAILED, 'system');
      await this.closeActiveRentalForVm(data.vm_id, data.error);

      // Free up the computer
      if (vm.physicalComputerId) {
        await this.computersService.updateStatus(
          vm.physicalComputerId,
          ComputerStatus.AVAILABLE,
        );
        await this.computersService.setCurrentVM(vm.physicalComputerId, null);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle provisioning failure: ${this.getErrorMessage(error)}`,
      );
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
    try {
      await this.vmService.updateStatus(data.vm_id, VMStatus.OFFLINE, 'system');
      const vm = await this.vmService.findOne(data.vm_id);

      if (vm.physicalComputerId) {
        await this.computersService.updateStatus(vm.physicalComputerId, ComputerStatus.AVAILABLE);
        await this.computersService.setCurrentVM(vm.physicalComputerId, null);
      }
    } catch (error) {
      this.logger.error(`Failed to handle VM stop: ${this.getErrorMessage(error)}`);
    }
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
      this.logger.error(
        `Failed to handle VM destruction: ${this.getErrorMessage(error)}`,
      );
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
      await this.vmService.updateHeartbeat(clientData.vmId);
      this.logger.debug(
        `Heartbeat received from computer ${clientData.hostname} for VM ${clientData.vmId}`,
      );
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

  private async closeActiveRentalForVm(vmId: string, debugReason: string): Promise<void> {
    const rental = await this.rentalRepository.findOne({
      where: { vmId, rentalState: RentalState.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    if (!rental) {
      return;
    }

    this.logger.warn(
      `Closing active rental ${rental.id} for VM ${vmId}. Reason: ${debugReason}`,
    );
    rental.endTime = new Date();
    rental.rentalState = RentalState.NOT_ACTIVE;
    rental.totalCost = 0;
    await this.rentalRepository.save(rental);
  }
}
