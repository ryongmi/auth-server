import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntityUUID } from '../../../common/entities';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { Expose } from 'class-transformer';
import { OAuthAccount } from './oauth-account.entity';

@Entity()
export class User extends BaseEntityUUID {
  @ApiProperty({ example: 'auth@naver.com', description: '사용자 이메일' })
  @Column({ type: 'varchar', length: 255, unique: true })
  @IsNotEmpty({ message: 'Email is required' }) // 비어 있으면 에러
  // @IsEmail({}, { message: 'Invalid email format' }) // 이메일 형식 검증
  @IsEmail() // 이메일 형식 검증
  @MaxLength(255, { message: 'Email address is too long' }) // 최대 길이 제한
  @Expose()
  email: string; // 이메일은 무조건 한번만 가입가능하게

  @ApiProperty({
    example: '0ba9965b-afaf-4771-bc59-7d697b3aa4b2',
    description: '사용자 비밀번호',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  @IsOptional()
  @IsString()
  password?: string; // 일반 회원가입자는 비밀번호 저장, OAuth 로그인자는 null

  @ApiProperty({ example: '홍길동', description: '사용자 이름' })
  @Column({
    type: 'varchar',
    length: 30,
  })
  @IsString()
  @Length(3, 30) // 이름 길이 제한 (최소 3자, 최대 30자)
  @Expose()
  name: string;

  @ApiProperty({ example: '동에번쩍', description: '사용자 별명' })
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  @IsString()
  @Length(2, 20) // 닉네임 길이 제한 (최소 2자, 최대 20자)
  @IsOptional()
  @Expose()
  nickname?: string;

  @ApiProperty({
    example:
      'https://yt3.ggpht.com/yti/ANjgQV-jbwsLEWnWPVS2r82jtApxqmShu-nPXW-_S1n7FCmlug=s88-c-k-c0x00ffffff-no-rj',
    description: '프로필 이미지 URL',
  })
  @Column({ type: 'varchar', length: 2048, nullable: true })
  @IsOptional() // 프로필 이미지가 필수가 아닌 경우
  @IsUrl(
    { protocols: ['https'] }, // HTTPS URL만 허용
    { message: 'Profile image must be a valid HTTPS URL' },
  )
  @MaxLength(2048, { message: 'Profile image URL is too long' }) // URL 길이 제한
  // @Matches(/\.(jpg|jpeg|png|gif)$/i, {
  //   message: 'Profile image must be a valid image file (jpg, jpeg, png, gif)',
  // }) // 이미지 파일 형식만 허용
  @Expose()
  profileImage?: string;

  @Column({ default: false })
  @IsBoolean()
  isEmailVerified: boolean; // 이메일 인증 여부

  @OneToOne(() => OAuthAccount, (oauthAccount) => oauthAccount.user, {
    cascade: true,
    nullable: true,
  })
  @JoinColumn()
  oauthAccount: OAuthAccount;
}
