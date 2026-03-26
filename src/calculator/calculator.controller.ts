import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CalculatorService } from './calculator.service';
import { CalculateRequirementsDto } from './dto/calculate-requirements.dto';

@ApiTags('calculator')
@Controller('calculator')
export class CalculatorController {
  constructor(private calculatorService: CalculatorService) {}

  @Post('estimate')
  @ApiOperation({ summary: 'Calculate resource requirements based on workload' })
  calculate(@Body() calculateDto: CalculateRequirementsDto) {
    return this.calculatorService.calculate(calculateDto);
  }
}