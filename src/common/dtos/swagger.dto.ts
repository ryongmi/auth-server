import { Type } from "@nestjs/common";

export class SwaagerApiTagsDto {
  tags: string[] = [];
}

export class SwaagerApiOperationDto {
  summary: string = "";
}

export class SwaagerApiResponseDto {
  status!: number;
  description: string = "";
  dto?: Type<unknown> | null;
}

export class SwaagerApiQueryDto {
  name!: string;
  type!: Type;
  description: string = "";
  required?: boolean = true;
}

export class SwaagerApiBodyDto {
  dto!: Type<unknown>;
  description: string = "";
  required?: boolean = true;
}
