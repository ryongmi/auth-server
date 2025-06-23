import { Entity, Column } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';
import { ProviderType } from '@krgeobuk/oauth/enum';

@Entity('oauth_account')
// @Unique(['id', 'userId'])
export class OAuthAccount extends BaseEntityUUID {
  @Column({ type: 'varchar', length: 255 })
  providerId!: string; // OAuth 제공자 고유 ID

  @Column({ type: 'enum', enum: ProviderType, unique: true })
  provider!: ProviderType; // google, naver 등

  // @Column({ type: 'varchar', length: 255 })
  // email!: string; // OAuth에서 받은 이메일, 통합 판단 시 참고용

  @Column({ type: 'uuid', unique: true })
  userId!: string; // FK 없이 userId 저장해서 직접 조회
}
