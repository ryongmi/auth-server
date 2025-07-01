import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

@Entity()
@Index('IDX_USER_EMAIL', ['email'], { unique: true })
export class User extends BaseEntityUUID {
  @Column({ type: 'varchar', length: 255 })
  email!: string; // 홈페이지 가입 이메일, 통합 기준

  @Column({ type: 'varchar', length: 255, nullable: true })
  password?: string; // 홈페이지 가입자만 있음

  @Column({ type: 'varchar', length: 30 })
  name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  nickname?: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  profileImageUrl?: string;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ default: false })
  isIntegrated!: boolean; // 홈페이지 + OAuth 통합 여부
}
