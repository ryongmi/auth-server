import { Expose, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { UserType, USER_TYPE_VALUES } from 'src/common/enum';

export class UserQueryDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  @IsIn(USER_TYPE_VALUES)
  provider?: UserType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  @Expose({ name: 'sort-order' }) // sort-order 쿼리 → sortOrder 프로퍼티에 매핑
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';
}
