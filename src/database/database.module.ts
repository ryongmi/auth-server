import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createTypeOrmConfig } from '@krgeobuk/database-config'; // 공통 패키지에서 import

// ESM에서 __filename, __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const entitiesPath = join(__dirname, '/../**/*.entity{.ts,.js}');

@Module({
  imports: [TypeOrmModule.forRootAsync(createTypeOrmConfig([entitiesPath]))],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
