import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VMRental, RentalState, PaymentStatus } from '../entities/vm-rental.entity';
import { VirtualMachinesService } from '../virtual-machines/virtual-machines.service';
import { VMStatus } from '../entities/virtual-machine.entity';
import { ComputerWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class RentalsService {
  constructor(
    @InjectRepository(VMRental)
    private rentalRepository: Repository<VMRental>,
    private vmService: VirtualMachinesService,
    private websocketGateway: ComputerWebSocketGateway,
  ) {}

  async create(vmId: string, receiverId: string): Promise<VMRental> {
    const vm = await this.vmService.findOne(vmId);

    if (vm.providerId === receiverId) {
      throw new BadRequestException('You cannot rent your own VM');
    }

    if (vm.status !== VMStatus.AVAILABLE) {
      throw new BadRequestException('VM is not currently available for rental');
    }

    const rental = this.rentalRepository.create({
      vmId,
      receiverId,
      startTime: new Date(),
      rentalState: RentalState.ACTIVE,
      paymentStatus: PaymentStatus.PENDING,
    });

    const savedRental = await this.rentalRepository.save(rental);

    // Reserve the VM for provisioning instead of marking it as already running.
    await this.vmService.updateStatus(vmId, VMStatus.BUILDING, vm.providerId);

    if (!vm.physicalComputerId) {
      await this.failRentalForVm(vmId);
      await this.vmService.updateStatus(vmId, VMStatus.FAILED, 'system');
      throw new BadRequestException('This VM is not linked to a provider machine yet');
    }

    const wasDispatched = await this.websocketGateway.sendProvisionVM(vm.physicalComputerId, {
      action: 'provision_vm',
      vm_id: vmId,
      rental_id: savedRental.id,
      os_choice: vm.os,
      specs: {
        memory: vm.ramGb * 1024,
        cpus: vm.cpuCores,
        disk: vm.storageGb,
      },
    });

    if (!wasDispatched) {
      await this.failRentalForVm(vmId);
      await this.vmService.updateStatus(vmId, VMStatus.FAILED, 'system');
      throw new BadRequestException('Provider machine is not connected right now');
    }

    return savedRental;
  }

  async findAll(userId: string): Promise<VMRental[]> {
    return await this.rentalRepository.find({
      where: [
        { receiverId: userId },
        { vm: { providerId: userId } },
      ],
      relations: ['vm', 'receiver'],
    });
  }

  async findOne(id: string): Promise<VMRental> {
    const rental = await this.rentalRepository.findOne({
      where: { id },
      relations: ['vm', 'receiver', 'jobs'],
    });

    if (!rental) {
      throw new NotFoundException('Rental not found');
    }

    return rental;
  }

  async endRental(id: string, userId: string): Promise<VMRental> {
    const rental = await this.findOne(id);

    if (rental.receiverId !== userId) {
      throw new BadRequestException('You can only end your own rentals');
    }

    if (rental.rentalState !== RentalState.ACTIVE) {
      throw new BadRequestException('Rental is not active');
    }

    rental.endTime = new Date();
    rental.rentalState = RentalState.NOT_ACTIVE;

    // Calculate total cost
    const hours = (rental.endTime.getTime() - rental.startTime.getTime()) / (1000 * 60 * 60);
    rental.totalCost = hours * Number(rental.vm.pricePerHour);

    const savedRental = await this.rentalRepository.save(rental);

    await this.vmService.updateStatus(rental.vmId, VMStatus.SHUTTING_DOWN, 'system');

    if (rental.vm.physicalComputerId) {
      const wasDispatched = await this.websocketGateway.sendDestroyVM(rental.vm.physicalComputerId, {
        action: 'destroy_vm',
        vm_id: rental.vmId,
      });

      if (!wasDispatched) {
        await this.vmService.updateStatus(rental.vmId, VMStatus.OFFLINE, 'system');
      }
    } else {
      await this.vmService.updateStatus(rental.vmId, VMStatus.OFFLINE, 'system');
    }

    return savedRental;
  }

  async processPayment(id: string, userId: string): Promise<VMRental> {
    const rental = await this.findOne(id);

    if (rental.receiverId !== userId) {
      throw new BadRequestException('You can only pay for your own rentals');
    }

    if (rental.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment already processed');
    }

    rental.paymentStatus = PaymentStatus.PAID;
    return await this.rentalRepository.save(rental);
  }

  async failRentalForVm(vmId: string): Promise<void> {
    const rental = await this.rentalRepository.findOne({
      where: { vmId, rentalState: RentalState.ACTIVE },
      relations: ['vm'],
      order: { createdAt: 'DESC' },
    });

    if (!rental) {
      return;
    }

    rental.endTime = new Date();
    rental.rentalState = RentalState.NOT_ACTIVE;
    rental.totalCost = 0;
    await this.rentalRepository.save(rental);
  }
}
