import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VMRental, RentalStatus, PaymentStatus } from '../entities/vm-rental.entity';
import { VirtualMachinesService } from '../virtual-machines/virtual-machines.service';
import { VMStatus } from '../entities/virtual-machine.entity';

@Injectable()
export class RentalsService {
  constructor(
    @InjectRepository(VMRental)
    private rentalRepository: Repository<VMRental>,
    private vmService: VirtualMachinesService,
  ) {}

  async create(vmId: string, receiverId: string): Promise<VMRental> {
    const vm = await this.vmService.findOne(vmId);

    if (vm.status !== VMStatus.AVAILABLE) {
      throw new BadRequestException('VM is not available for rental');
    }

    if (vm.providerId === receiverId) {
      throw new BadRequestException('You cannot rent your own VM');
    }

    const rental = this.rentalRepository.create({
      vmId,
      receiverId,
      startTime: new Date(),
      status: RentalStatus.ACTIVE,
      paymentStatus: PaymentStatus.PENDING,
    });

    const savedRental = await this.rentalRepository.save(rental);

    // Update VM status to running
    await this.vmService.updateStatus(vmId, VMStatus.RUNNING, vm.providerId);

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

    if (rental.status !== RentalStatus.ACTIVE) {
      throw new BadRequestException('Rental is not active');
    }

    rental.endTime = new Date();
    rental.status = RentalStatus.COMPLETED;

    // Calculate total cost
    const hours = (rental.endTime.getTime() - rental.startTime.getTime()) / (1000 * 60 * 60);
    rental.totalCost = hours * Number(rental.vm.pricePerHour);

    const savedRental = await this.rentalRepository.save(rental);

    // Update VM status back to available
    await this.vmService.updateStatus(rental.vmId, VMStatus.AVAILABLE, rental.vm.providerId);

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
}