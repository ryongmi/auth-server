import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export abstract class TimestampDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    required: false,
  })
  @IsDate()
  @IsOptional()
  @Expose()
  createdAt?: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    required: false,
  })
  @IsDate()
  @IsOptional()
  @Expose()
  updatedAt?: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    required: false,
    nullable: true,
  })
  @IsDate()
  @IsOptional()
  deletedAt?: Date | null;
}
