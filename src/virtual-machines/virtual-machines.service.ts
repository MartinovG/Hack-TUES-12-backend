import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VirtualMachine, VMStatus } from '../entities/virtual-machine.entity';
import { CreateVMDto } from './dto/create-vm.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class VirtualMachinesService {
  constructor(
    @InjectRepository(VirtualMachine)
    private vmRepository: Repository<VirtualMachine>,
  ) {}

  async create(createVMDto: CreateVMDto, providerId: string): Promise<VirtualMachine> {
    const connectionToken = randomBytes(32).toString('hex');
    
    const vm = this.vmRepository.create({
      ...createVMDto,
      providerId,
      connectionToken,
      status: VMStatus.CONFIGURING,
    });

    return await this.vmRepository.save(vm);
  }

  async findAll(filters?: {
    minCpu?: number;
    minRam?: number;
    minStorage?: number;
    hasGpu?: boolean;
    status?: VMStatus;
  }): Promise<VirtualMachine[]> {
    const query = this.vmRepository.createQueryBuilder('vm');

    if (filters?.minCpu) {
      query.andWhere('vm.cpu_cores >= :minCpu', { minCpu: filters.minCpu });
    }

    if (filters?.minRam) {
      query.andWhere('vm.ram_gb >= :minRam', { minRam: filters.minRam });
    }

    if (filters?.minStorage) {
      query.andWhere('vm.storage_gb >= :minStorage', { minStorage: filters.minStorage });
    }

    if (filters?.hasGpu) {
      query.andWhere('vm.gpu_model IS NOT NULL');
    }

    if (filters?.status) {
      query.andWhere('vm.status = :status', { status: filters.status });
    }

    return await query.getMany();
  }

  async findOne(id: string): Promise<VirtualMachine> {
    const vm = await this.vmRepository.findOne({
      where: { id },
      relations: ['provider'],
    });

    if (!vm) {
      throw new NotFoundException('Virtual machine not found');
    }

    return vm;
  }

  async findByConnectionToken(token: string): Promise<VirtualMachine> {
    const vm = await this.vmRepository.findOne({
      where: { connectionToken: token },
    });

    if (!vm) {
      throw new NotFoundException('Virtual machine not found');
    }

    return vm;
  }

  async updateStatus(id: string, status: VMStatus, userId: string): Promise<VirtualMachine> {
    const vm = await this.findOne(id);

    // Allow system updates (userId === 'system') or owner updates
    if (userId !== 'system' && vm.providerId !== userId) {
      throw new ForbiddenException('You can only update your own VMs');
    }

    vm.status = status;
    vm.lastHeartbeat = new Date();

    return await this.vmRepository.save(vm);
  }

  async setPhysicalComputer(vmId: string, computerId: string | null): Promise<void> {
    await this.vmRepository.update(vmId, { physicalComputerId: computerId });
  }

  async updateVMInfo(vmId: string, info: {
    ipAddress?: string;
    sshPort?: number;
    sshUsername?: string;
  }): Promise<void> {
    const updateData: any = {};
    if (info.ipAddress) updateData.vmIpAddress = info.ipAddress;
    if (info.sshPort) updateData.vmSshPort = info.sshPort;
    if (info.sshUsername) updateData.vmSshUsername = info.sshUsername;
    
    await this.vmRepository.update(vmId, updateData);
  }

  async updateHeartbeat(vmId: string): Promise<void> {
    await this.vmRepository.update(vmId, { lastHeartbeat: new Date() });
  }

  async delete(id: string, userId: string): Promise<void> {
    const vm = await this.findOne(id);

    if (vm.providerId !== userId) {
      throw new ForbiddenException('You can only delete your own VMs');
    }

    await this.vmRepository.delete(id);
  }

  async findByProvider(providerId: string): Promise<VirtualMachine[]> {
    return await this.vmRepository.find({
      where: { providerId },
    });
  }
}
