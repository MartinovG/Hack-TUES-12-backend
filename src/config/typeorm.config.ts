import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from '../entities/user.entity';
import { VirtualMachine } from '../entities/virtual-machine.entity';
import { VMRental } from '../entities/vm-rental.entity';
import { VMJob } from '../entities/vm-job.entity';
import { VMUsageMetric } from '../entities/vm-usage-metric.entity';

config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_DATABASE'),
  entities: [User, VirtualMachine, VMRental, VMJob, VMUsageMetric],
  migrations: ['src/migrations/*.ts'],
  synchronize: true,
});
