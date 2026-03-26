import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalsService } from './rentals.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('rentals')
@Controller('rentals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RentalsController {
  constructor(private rentalsService: RentalsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a rental (receiver)' })
  async create(@Body() createRentalDto: CreateRentalDto, @Request() req) {
    return this.rentalsService.create(createRentalDto.vmId, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List user rentals (as provider or receiver)' })
  async findAll(@Request() req) {
    return this.rentalsService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get rental details' })
  async findOne(@Param('id') id: string) {
    return this.rentalsService.findOne(id);
  }

  @Patch(':id/end')
  @ApiOperation({ summary: 'End a rental' })
  async endRental(@Param('id') id: string, @Request() req) {
    return this.rentalsService.endRental(id, req.user.userId);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Simulate payment for rental' })
  async pay(@Param('id') id: string, @Request() req) {
    return this.rentalsService.processPayment(id, req.user.userId);
  }
}