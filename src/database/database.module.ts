import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        namingStrategy: new SnakeNamingStrategy(),
        type: 'mysql',
        host: config.get<string>('db-mysql.host'),
        // host: `mysql-auth-${config.get<string>('mode')}`,
        port: config.get<number>('db-mysql.port'),
        username: config.get<string>('db-mysql.username'),
        password: config.get<string>('db-mysql.password'),
        database: config.get<string>('db-mysql.name'),
        synchronize: config.get<boolean>('db-mysql.synchronize'),
        logging: config.get<boolean>('db-mysql.logging'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        // ...config.get<any>('common'), // 공통 설정 가져오기
      }),
    }),
  ],
})
export class DatabaseModule {}
