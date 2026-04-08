import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
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
import { PhysicalComputer } from './entities/physical-computer.entity';
import { DownloadModule } from './download/download.module';
import { ComputersModule } from './computers/computers.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const typeOrmImports = process.env.SKIP_DB === '1'
  ? []
  : [
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
          const databaseUrl = configService.get<string>('DATABASE_URL');
          const useSsl = databaseUrl || configService.get<string>('DB_SSL', 'true') === 'true';
          const shouldSynchronize =
            configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true' ||
            configService.get('NODE_ENV') === 'development';

          return {
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
            synchronize: shouldSynchronize,
            logging: shouldSynchronize,
          };
        },
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
          ComputersModule,
          WebSocketModule,
        ]),
    DownloadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
