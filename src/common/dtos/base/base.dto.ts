import { TimestampDto } from "./timestamp.dto";
import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsUUID } from "class-validator";

export abstract class BaseDtoIncrement extends TimestampDto {
  @ApiProperty({
    example: 5,
    description: "Auto Increment",
  })
  @IsNumber()
  id!: number;
}

export abstract class BaseDtoIncrementIsOptional extends TimestampDto {
  @ApiProperty({
    example: 5,
    description: "Auto Increment",
  })
  @IsNumber()
  @IsOptional()
  id?: number;
}

export abstract class BaseDtoUUID extends TimestampDto {
  @ApiProperty({
    example: "0ba9965b-afaf-4771-bc59-7d697b3aa4b2",
    description: "UUID",
  })
  @IsUUID()
  id!: string;
}

export abstract class BaseDtoUUIDIsOptional extends TimestampDto {
  @ApiProperty({
    example: "0ba9965b-afaf-4771-bc59-7d697b3aa4b2",
    description: "UUID",
  })
  @IsUUID()
  @IsOptional()
  id?: string;
}
