import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VirtualMachinesModule } from './virtual-machines/virtual-machines.module';
import { RentalsModule } from './rentals/rentals.module';
import { JobsModule } from './jobs/jobs.module';
import { MetricsModule } from './metrics/metrics.module';
import { CalculatorModule } from './calculator/calculator.module';
import { User } from './entities/user.entity';
import { VirtualMachine } from './entities/virtual-machine.entity';
import { VMRental } from './entities/vm-rental.entity';
import { VMJob } from './entities/vm-job.entity';
import { VMUsageMetric } from './entities/vm-usage-metric.entity';
import { DownloadModule } from './download/download.module';

const typeOrmImports = process.env.SKIP_DB === '1'
  ? []
  : [
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST'),
          port: configService.get('DB_PORT'),
          username: configService.get('DB_USERNAME'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_DATABASE'),
          entities: [User, VirtualMachine, VMRental, VMJob, VMUsageMetric],
          synchronize: configService.get('NODE_ENV') === 'development',
          logging: configService.get('NODE_ENV') === 'development',
        }),
        inject: [ConfigService],
      }),
    ];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ...typeOrmImports,
    ...(process.env.SKIP_DB === '1'
      ? []
      : [
          AuthModule,
          UsersModule,
          VirtualMachinesModule,
          RentalsModule,
          JobsModule,
          MetricsModule,
          CalculatorModule,
        ]),
    DownloadModule,
  ],
})
export class AppModule {}
