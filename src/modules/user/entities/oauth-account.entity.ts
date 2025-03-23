import { User } from './user.entity';
import { BaseEntityUUID } from '../../../common/entities/base.entity';
import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { Expose } from 'class-transformer';

@Entity()
export class OAuthAccount extends BaseEntityUUID {
  @ApiProperty({
    example: 'google',
    description: '사용자 계정 타입',
  })
  @Column({ type: 'varchar', length: 255 })
  @IsString()
  @Expose()
  provider: string; // 'google', 'naver' 등 OAuth 제공자

  @ApiProperty({
    example: '0ba9965b-afaf-4771-bc59-7d697b3aa4b2',
    description: 'OAuth를 이용해 가입할시 저장되는 SSO 유저 ID',
  })
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  @IsUUID()
  providerId: string; // OAuth 제공자의 사용자 고유 ID

  //   @ManyToOne(() => User, (user) => user.oauthAccounts, { onDelete: 'CASCADE' })
  //   user: User;
  @OneToOne(() => User, (user) => user.oauthAccount, { onDelete: 'CASCADE' })
  @JoinColumn() // 연결된 테이블에서 외래키를 관리하도록 지정
  user: User;
}
