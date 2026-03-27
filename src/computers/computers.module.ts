import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComputersService } from './computers.service';
import { ComputersController } from './computers.controller';
import { PhysicalComputer } from '../entities/physical-computer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PhysicalComputer])],
  controllers: [ComputersController],
  providers: [ComputersService],
  exports: [ComputersService],
})
export class ComputersModule {}