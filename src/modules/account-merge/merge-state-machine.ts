import { AccountMergeStatus } from '@krgeobuk/shared/account-merge';
import { AccountMergeException } from '@krgeobuk/account-merge/exception';

import { MERGE_REQUEST_EXPIRATION_HOURS, MS_PER_HOUR } from '@common/constants/index.js';

import { AccountMergeEntity } from './entities/account-merge.entity.js';

/**
 * 계정 병합 상태 전환을 관리하는 상태 머신
 *
 * 상태 전환 규칙:
 * - PENDING_EMAIL_VERIFICATION → IN_PROGRESS (confirm)
 * - PENDING_EMAIL_VERIFICATION → CANCELLED (reject or expire)
 * - IN_PROGRESS → COMPLETED (merge success)
 * - IN_PROGRESS → FAILED (merge failure)
 */
export class MergeStateMachine {

  /**
   * 상태 전환 가능 여부 확인
   */
  static canTransition(from: AccountMergeStatus, to: AccountMergeStatus): boolean {
    const transitions: Record<AccountMergeStatus, AccountMergeStatus[]> = {
      [AccountMergeStatus.PENDING_EMAIL_VERIFICATION]: [
        AccountMergeStatus.IN_PROGRESS,
        AccountMergeStatus.CANCELLED,
      ],
      [AccountMergeStatus.IN_PROGRESS]: [
        AccountMergeStatus.COMPLETED,
        AccountMergeStatus.FAILED,
      ],
      [AccountMergeStatus.COMPLETED]: [],
      [AccountMergeStatus.FAILED]: [],
      [AccountMergeStatus.CANCELLED]: [],
    };

    return transitions[from]?.includes(to) ?? false;
  }

  /**
   * 사용자가 병합 요청에 대한 권한이 있는지 확인
   * User A (유지할 계정, targetUserId)만 승인/거부 가능
   */
  static validateTargetUserPermission(request: AccountMergeEntity, userId: string): void {
    if (request.targetUserId !== userId) {
      throw AccountMergeException.unauthorized();
    }
  }

  /**
   * 병합 요청이 만료되지 않았는지 확인
   */
  static validateNotExpired(request: AccountMergeEntity): void {
    const hoursSinceCreation =
      (Date.now() - request.createdAt.getTime()) / MS_PER_HOUR;

    if (hoursSinceCreation > MERGE_REQUEST_EXPIRATION_HOURS) {
      throw AccountMergeException.requestExpired();
    }
  }

  /**
   * confirm/reject 전 공통 검증
   * 상태가 PENDING_EMAIL_VERIFICATION인지 확인
   */
  static validatePendingState(request: AccountMergeEntity): void {
    if (request.status !== AccountMergeStatus.PENDING_EMAIL_VERIFICATION) {
      throw AccountMergeException.invalidStatus();
    }
  }

  /**
   * 상태 전환 유효성 검증 및 실행
   */
  static validateAndTransition(
    request: AccountMergeEntity,
    targetStatus: AccountMergeStatus
  ): void {
    if (!this.canTransition(request.status, targetStatus)) {
      throw AccountMergeException.invalidTransition(request.status, targetStatus);
    }
  }

  /**
   * 병합 확인 전 모든 검증 수행
   */
  static validateConfirm(request: AccountMergeEntity, userId: string): void {
    this.validateTargetUserPermission(request, userId);
    this.validatePendingState(request);
    this.validateNotExpired(request);
  }

  /**
   * 병합 거부 전 모든 검증 수행
   */
  static validateReject(request: AccountMergeEntity, userId: string): void {
    this.validateTargetUserPermission(request, userId);
    this.validatePendingState(request);
  }
}
