import { Entity, Column, Index, Unique } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';
import { OAuthAccountProviderType, OAUTH_ACCOUNT_PROVIDER_TYPE_VALUES } from '@krgeobuk/oauth/enum';

@Entity('oauth_account')
@Index(['id', 'userId'], { unique: true })
@Index('IDX_OAUTH_ACCOUNT_USER_ID', ['userId'])
@Unique(['userId', 'provider'])
export class OAuthAccountEntity extends BaseEntityUUID {
  @Column({ type: 'varchar', length: 255 })
  providerId!: string; // OAuth 제공자 고유 ID

  @Column({ type: 'enum', enum: OAUTH_ACCOUNT_PROVIDER_TYPE_VALUES })
  provider!: OAuthAccountProviderType; // google, naver 등

  // @Column({ type: 'varchar', length: 255 })
  // email!: string; // OAuth에서 받은 이메일, 통합 판단 시 참고용

  @Column({ type: 'uuid' })
  userId!: string; // FK 없이 userId 저장해서 직접 조회
}
