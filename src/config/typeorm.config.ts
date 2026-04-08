import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from '../entities/user.entity';
import { VirtualMachine } from '../entities/virtual-machine.entity';
import { VMRental } from '../entities/vm-rental.entity';
import { VMJob } from '../entities/vm-job.entity';
import { VMUsageMetric } from '../entities/vm-usage-metric.entity';
import { PhysicalComputer } from '../entities/physical-computer.entity';

config();

const configService = new ConfigService();
const databaseUrl = configService.get<string>('DATABASE_URL');
const useSsl = databaseUrl || configService.get<string>('DB_SSL', 'true') === 'true';

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
      }),
  ...(useSsl
    ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {}),
  entities: [User, VirtualMachine, VMRental, VMJob, VMUsageMetric, PhysicalComputer],
  migrations: ['src/migrations/*.ts'],
  synchronize: true,
};

export default new DataSource(dataSourceOptions);
