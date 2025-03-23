import { Type } from '@nestjs/common';

export class SwaagerApiTagsDto {
  tags?: string[] | null;
}

export class SwaagerApiOperationDto {
  summary?: string | null;
}

export class SwaagerApiResponseDto {
  status: number;
  description?: string | null;
  dto?: Type<any> | null;
}

export class SwaagerApiQueryDto {
  name: string;
  type: Type;
  description?: string | null;
  required?: boolean = true;
}

export class SwaagerApiBodyDto {
  dto: Type<any>;
  description?: string | null;
  required?: boolean = true;
}
