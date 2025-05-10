import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID, IsIn } from 'class-validator';
import { USER_TYPE_VALUES } from 'src/common/enum';

// oauth id 유효성 검사
export function IsValidProviderId(isOptional = false) {
  const decorators = [
    ApiProperty({
      example: '0ba9965b-afaf-4771-bc59-7d697b3aa4b2',
      description: 'OAuth를 이용해 가입할시 저장되는 SSO 유저 ID',
    }),
    IsUUID(),
  ];

  if (isOptional) {
    return applyDecorators(IsOptional(), ...decorators);
  }
  return applyDecorators(
    IsNotEmpty({ message: 'oauth id는 필수입니다' }),
    ...decorators,
  );
}

// oauth type 유효성 검사
export function IsValidProvider(isOptional = false) {
  const decorators = [
    ApiProperty({
      example: USER_TYPE_VALUES,
      description: '사용자 계정 타입',
    }),
    IsIn(USER_TYPE_VALUES),
  ];

  if (isOptional) {
    return applyDecorators(IsOptional(), ...decorators);
  }
  return applyDecorators(
    IsNotEmpty({ message: 'oauth type은 필수입니다' }),
    ...decorators,
  );
}
