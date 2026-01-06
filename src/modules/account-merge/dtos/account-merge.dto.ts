import { ApiProperty } from '@nestjs/swagger';

import { IsString, IsEmail, IsEnum } from 'class-validator';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';

/**
 * 계정 병합 요청 DTO
 * User A가 이미 가입된 이메일로 다른 OAuth provider로 로그인 시도 시 사용
 */
export class InitiateAccountMergeDto {
  @ApiProperty({
    description: 'OAuth 제공자 (Google or Naver)',
    enum: OAuthAccountProviderType,
    example: OAuthAccountProviderType.GOOGLE,
  })
  @IsEnum(OAuthAccountProviderType)
  provider!: OAuthAccountProviderType;

  @ApiProperty({
    description: 'OAuth 제공자의 사용자 ID (고유 식별자)',
    example: '1234567890',
  })
  @IsString()
  providerId!: string;

  @ApiProperty({
    description: '이메일 주소 (User A와 User B가 공유하는 이메일)',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;
}

/**
 * 계정 병합 요청 조회 응답 DTO
 */
export class AccountMergeResponseDto {
  @ApiProperty({ description: '병합 요청 ID' })
  id!: string;

  @ApiProperty({ description: '요청 생성 시각' })
  createdAt!: Date;

  @ApiProperty({ description: '요청 만료 시각' })
  expiresAt!: Date;

  @ApiProperty({ description: 'OAuth 제공자', enum: OAuthAccountProviderType })
  provider!: OAuthAccountProviderType;

  @ApiProperty({ description: '병합 상태', example: 'PENDING' })
  status!: string;

  @ApiProperty({ description: 'User A (새로운 OAuth 계정 소유자) 이메일' })
  sourceEmail!: string;

  @ApiProperty({ description: 'User B (기존 계정 소유자) 이메일' })
  targetEmail!: string;
}
