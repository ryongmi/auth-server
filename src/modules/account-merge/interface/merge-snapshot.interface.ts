import type { MyPickSnapshotData } from '@krgeobuk/account-merge/tcp/interfaces';

import { OAuthAccountEntity } from '@modules/oauth/index.js';
import { UserEntity } from '@modules/user/index.js';

/**
 * 계정 병합 스냅샷 인터페이스
 * Redis에 7일간 보관하여 롤백 시 사용
 *
 * 용어 정의:
 * - User A (target): 유지할 계정, 기존 이메일 소유자
 * - User B (source): 삭제될 계정, 새 OAuth로 로그인 시도한 사용자
 */
export interface MergeSnapshot {
  /** User A (유지할 계정) ID */
  targetUserId: string;
  /** User B (삭제될 계정) 정보 */
  sourceUser: UserEntity;
  /** User B의 OAuth 계정 정보 */
  sourceOAuthAccounts: OAuthAccountEntity[];
  /** User B의 역할 ID 목록 (authz-server에서 조회) */
  sourceRoleIds: string[];
  /** User B의 my-pick 데이터 (my-pick-server에서 조회) */
  sourceMyPickData: MyPickSnapshotData;
  /** 백업 생성 시각 */
  backupTimestamp: Date;
}
