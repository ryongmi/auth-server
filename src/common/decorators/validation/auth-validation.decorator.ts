import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

// accessToken 유효성 검사
export function IsValidAccessToken(isOptional = false) {
  const decorators = [
    ApiProperty({ example: '홍길동', description: '사용자 이름' }),
    IsString(),
  ];

  if (isOptional) {
    return applyDecorators(IsOptional(), ...decorators);
  }
  return applyDecorators(
    IsNotEmpty({ message: 'Access Token은은 필수입니다' }),
    ...decorators,
  );
}
