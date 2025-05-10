import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  Matches,
  IsOptional,
  MaxLength,
  Length,
  IsUrl,
  IsBoolean,
} from 'class-validator';

// 이메일 유효성 검사
export function IsValidEmail(isOptional = false) {
  const decorators = [
    ApiProperty({ example: 'auth@naver.com', description: '사용자 이메일' }),
    IsEmail({}, { message: '유효한 이메일 형식이 아닙니다' }), // 이메일 형식 검증
    MaxLength(255, { message: 'Email address is too long' }), // 최대 길이 제한
  ];

  if (isOptional) {
    return applyDecorators(IsOptional(), ...decorators);
  }
  return applyDecorators(
    IsNotEmpty({ message: '이메일은 필수입니다' }),
    ...decorators,
  );
}

// 비밀번호 유효성 검사
export function IsValidPassword(isOptional = false) {
  const decorators = [
    ApiProperty({ example: 'P@ssw0rd!', description: '사용자 비밀번호' }),
    MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다' }),
    Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
      message:
        '비밀번호는 최소 하나의 대문자, 소문자, 숫자나 특수문자를 포함해야 합니다',
    }),
  ];

  if (isOptional) {
    return applyDecorators(IsOptional(), ...decorators);
  }
  return applyDecorators(
    IsNotEmpty({ message: '비밀번호는 필수입니다' }),
    ...decorators,
  );
}

// 사용자 이름 유효성 검사
export function IsValidUsername(isOptional = false) {
  const decorators = [
    ApiProperty({ example: '홍길동', description: '사용자 이름' }),
    IsString(),
    MinLength(3, { message: '사용자 이름은 최소 3자 이상이어야 합니다' }),
    Length(3, 30),
    // Matches(/^[a-zA-Z0-9_-]+$/, {
    //   message:
    //     '사용자 이름은 영문자, 숫자, 밑줄(_), 하이픈(-)만 포함할 수 있습니다',
    // }),
  ];

  if (isOptional) {
    return applyDecorators(IsOptional(), ...decorators);
  }
  return applyDecorators(
    IsNotEmpty({ message: '사용자 이름은 필수입니다' }),
    ...decorators,
  );
}

// 사용자 닉네임 유효성 검사
export function IsValidNickname(isOptional = false) {
  const decorators = [
    ApiProperty({ example: '동에번쩍', description: '사용자 별명' }),
    IsString(),
    MinLength(2, { message: '닉네임은 최소 2자 이상이어야 합니다' }),
    Length(2, 20), // 닉네임 길이 제한 (최소 2자, 최대 20자),
    // Matches(/^[a-zA-Z0-9_-]+$/, {
    //   message:
    //     '사용자 이름은 영문자, 숫자, 밑줄(_), 하이픈(-)만 포함할 수 있습니다',
    // }),
  ];

  if (isOptional) {
    return applyDecorators(IsOptional(), ...decorators);
  }
  return applyDecorators(
    IsNotEmpty({ message: '닉네임은 필수입니다' }),
    ...decorators,
  );
}

// 사용자 프로필 유효성 검사
export function IsValidProfileImage(isOptional = false) {
  const decorators = [
    ApiProperty({
      example:
        'https://yt3.ggpht.com/yti/ANjgQV-jbwsLEWnWPVS2r82jtApxqmShu-nPXW-_S1n7FCmlug=s88-c-k-c0x00ffffff-no-rj',
      description: '프로필 이미지 URL',
    }),
    IsUrl(
      { protocols: ['https'] }, // HTTPS URL만 허용
      { message: 'Profile image must be a valid HTTPS URL' },
    ),
    MaxLength(2048, { message: 'Profile image URL is too long' }), // URL 길이 제한,
  ];

  if (isOptional) {
    return applyDecorators(IsOptional(), ...decorators);
  }
  return applyDecorators(
    IsNotEmpty({ message: '프로필 URL은은 필수입니다' }),
    ...decorators,
  );
}

// 이메일 검증 유무 유효성 검사
export function IsValidIsEmailVerified(isOptional = false) {
  const decorators = [
    ApiProperty({
      example: false,
      description: '이메일 검증 여부',
    }),
    IsBoolean(),
  ];

  if (isOptional) {
    return applyDecorators(IsOptional(), ...decorators);
  }
  return applyDecorators(
    IsNotEmpty({ message: '프로필 URL은은 필수입니다' }),
    ...decorators,
  );
}
