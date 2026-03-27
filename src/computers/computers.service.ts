import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhysicalComputer, ComputerStatus } from '../entities/physical-computer.entity';
import { RegisterComputerDto } from './dto/register-computer.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class ComputersService {
  constructor(
    @InjectRepository(PhysicalComputer)
    private computerRepository: Repository<PhysicalComputer>,
  ) {}

  async register(registerDto: RegisterComputerDto): Promise<PhysicalComputer> {
    // Check if computer already exists
    const existing = await this.computerRepository.findOne({
      where: { connectionToken: registerDto.connection_token },
    });

    if (existing) {
      // Update existing computer
      existing.hostname = registerDto.hostname;
      existing.cpuCores = registerDto.capabilities.cpu_cores;
      existing.ramGb = registerDto.capabilities.ram_gb;
      existing.storageGb = registerDto.capabilities.storage_gb;
      existing.hostOs = registerDto.capabilities.os;
      existing.isConnected = true;
      existing.status = ComputerStatus.AVAILABLE;
      existing.lastHeartbeat = new Date();
      return await this.computerRepository.save(existing);
    }

    // Create new computer
    const computer = this.computerRepository.create({
      hostname: registerDto.hostname,
      connectionToken: registerDto.connection_token,
      cpuCores: registerDto.capabilities.cpu_cores,
      ramGb: registerDto.capabilities.ram_gb,
      storageGb: registerDto.capabilities.storage_gb,
      hostOs: registerDto.capabilities.os,
      isConnected: true,
      isAvailable: true,
      status: ComputerStatus.AVAILABLE,
      lastHeartbeat: new Date(),
    });

    return await this.computerRepository.save(computer);
  }

  async findAll(): Promise<PhysicalComputer[]> {
    return await this.computerRepository.find({
      relations: ['virtualMachines'],
    });
  }

  async findAvailable(requirements?: {
    minCpu?: number;
    minRam?: number;
    minStorage?: number;
  }): Promise<PhysicalComputer[]> {
    const query = this.computerRepository
      .createQueryBuilder('computer')
      .where('computer.isConnected = :connected', { connected: true })
      .andWhere('computer.isAvailable = :available', { available: true })
      .andWhere('computer.status = :status', { status: ComputerStatus.AVAILABLE });

    if (requirements?.minCpu) {
      query.andWhere('computer.cpu_cores >= :minCpu', { minCpu: requirements.minCpu });
    }

    if (requirements?.minRam) {
      query.andWhere('computer.ram_gb >= :minRam', { minRam: requirements.minRam });
    }

    if (requirements?.minStorage) {
      query.andWhere('computer.storage_gb >= :minStorage', {
        minStorage: requirements.minStorage,
      });
    }

    return await query.getMany();
  }

  async findOne(id: string): Promise<PhysicalComputer> {
    const computer = await this.computerRepository.findOne({
      where: { id },
      relations: ['virtualMachines'],
    });

    if (!computer) {
      throw new NotFoundException('Computer not found');
    }

    return computer;
  }

  async findByConnectionToken(token: string): Promise<PhysicalComputer> {
    const computer = await this.computerRepository.findOne({
      where: { connectionToken: token },
    });

    if (!computer) {
      throw new NotFoundException('Computer not found');
    }

    return computer;
  }

  async updateStatus(id: string, status: ComputerStatus): Promise<PhysicalComputer> {
    const computer = await this.findOne(id);
    computer.status = status;
    
    if (status === ComputerStatus.AVAILABLE) {
      computer.isAvailable = true;
      computer.currentVmId = null;
    } else if (status === ComputerStatus.ACTIVE || status === ComputerStatus.PROVISIONING) {
      computer.isAvailable = false;
    }

    return await this.computerRepository.save(computer);
  }

  async setConnected(id: string, isConnected: boolean): Promise<void> {
    await this.computerRepository.update(id, {
      isConnected,
      status: isConnected ? ComputerStatus.AVAILABLE : ComputerStatus.OFFLINE,
      lastHeartbeat: isConnected ? new Date() : null,
    });
  }

  async updateHeartbeat(id: string): Promise<void> {
    await this.computerRepository.update(id, { lastHeartbeat: new Date() });
  }

  async setCurrentVM(computerId: string, vmId: string | null): Promise<void> {
    await this.computerRepository.update(computerId, { currentVmId: vmId });
  }

  async selectBestComputer(requirements: {
    minCpu: number;
    minRam: number;
    minStorage: number;
  }): Promise<PhysicalComputer> {
    const availableComputers = await this.findAvailable(requirements);

    if (availableComputers.length === 0) {
      throw new BadRequestException('No available computers meet the requirements');
    }

    // Simple selection: pick the one with most resources
    availableComputers.sort((a, b) => {
      const scoreA = a.cpuCores + a.ramGb + a.storageGb;
      const scoreB = b.cpuCores + b.ramGb + b.storageGb;
      return scoreB - scoreA;
    });

    return availableComputers[0];
  }

  async generateConnectionToken(): Promise<string> {
    return randomBytes(32).toString('hex');
  }
}