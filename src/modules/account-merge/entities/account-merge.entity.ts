import { Entity, Column, Index } from 'typeorm';

import { BaseEntityIncrement } from '@krgeobuk/core/entities';
import {
  OAuthAccountProviderType,
  OAUTH_ACCOUNT_PROVIDER_TYPE_VALUES,
} from '@krgeobuk/shared/oauth';
import { AccountMergeStatus, ACCOUNT_MERGE_STATUS_VALUES } from '@krgeobuk/oauth/enum';

/**
 * 계정 병합 엔티티
 * User A (유지할 계정)와 User B (삭제될 계정)의 병합 프로세스를 추적
 *
 * ID: AUTO_INCREMENT (BIGINT)
 * - K8s 레플리카 환경에서도 안전 (단일 RDS 사용)
 * - 성능 최적화 (UUID 대비 인덱스 크기 4.5배 감소)
 */
@Entity('account_merge')
@Index('IDX_ACCOUNT_MERGE_TARGET_USER_ID', ['targetUserId'])
@Index('IDX_ACCOUNT_MERGE_SOURCE_USER_ID', ['sourceUserId'])
@Index('IDX_ACCOUNT_MERGE_STATUS', ['status'])
export class AccountMergeEntity extends BaseEntityIncrement {
  /** User A (유지할 계정) */
  @Column({ type: 'uuid', comment: 'User A (유지할 계정)' })
  targetUserId!: string;

  /** User B (삭제될 계정) */
  @Column({ type: 'uuid', comment: 'User B (삭제될 계정)' })
  sourceUserId!: string;

  /** OAuth 제공자 타입 */
  @Column({ type: 'enum', enum: OAUTH_ACCOUNT_PROVIDER_TYPE_VALUES })
  provider!: OAuthAccountProviderType;

  /** OAuth 제공자 고유 ID */
  @Column({ type: 'varchar', length: 255 })
  providerId!: string;

  /** 병합 진행 상태 */
  @Column({
    type: 'enum',
    enum: ACCOUNT_MERGE_STATUS_VALUES,
    default: AccountMergeStatus.PENDING_EMAIL_VERIFICATION,
  })
  status!: AccountMergeStatus;

  /** 오류 메시지 (실패 시) */
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  /** 재시도 횟수 */
  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  /** 이메일 인증 완료 시각 */
  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt?: Date;

  /** 병합 완료 시각 */
  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;
}
