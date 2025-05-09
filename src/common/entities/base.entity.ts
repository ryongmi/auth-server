import { PrimaryGeneratedColumn } from 'typeorm';
import { TimestampEntity } from './timestamp.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export abstract class BaseEntityIncrement extends TimestampEntity {
  @ApiProperty({
    example: 5,
    description: 'Auto Increment',
  })
  @PrimaryGeneratedColumn()
  id: number;
}

export abstract class BaseEntityUUID extends TimestampEntity {
  @ApiProperty({
    example: '0ba9965b-afaf-4771-bc59-7d697b3aa4b2',
    description: 'UUID',
  })
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;
}
