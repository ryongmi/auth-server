import { User } from './user.entity';
import { BaseEntityUUID } from '../../../common/entities/base.entity';
import { UserType, USER_TYPE_VALUES } from '../../../common/enum';
import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { Expose } from 'class-transformer';

@Entity('oauth_account')
export class OAuthAccount extends BaseEntityUUID {
  @ApiProperty({
    example: '0ba9965b-afaf-4771-bc59-7d697b3aa4b2',
    description: 'OAuth를 이용해 가입할시 저장되는 SSO 유저 ID',
  })
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  @IsUUID()
  providerId: string; // OAuth 제공자의 사용자 고유 ID

  @ApiProperty({
    example: USER_TYPE_VALUES,
    description: '사용자 계정 타입',
  })
  @Column({ type: 'varchar', length: 255 })
  @IsIn(USER_TYPE_VALUES)
  @Expose()
  provider: UserType; // 'google', 'naver' 등 OAuth 제공자

  //   @ManyToOne(() => User, (user) => user.oauthAccounts, { onDelete: 'CASCADE' })
  //   user: User;
  @OneToOne(() => User, (user) => user.oauthAccount, { onDelete: 'CASCADE' })
  @JoinColumn() // 연결된 테이블에서 외래키를 관리하도록 지정
  user: User;
}
