import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AccountMergeStatus } from '@krgeobuk/shared/account-merge';

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
  private static readonly EXPIRATION_HOURS = 24;
  private static readonly MS_PER_HOUR = 1000 * 60 * 60;

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
   */
  static validateTargetUserPermission(request: AccountMergeEntity, userId: string): void {
    if (request.targetUserId !== userId) {
      throw new ForbiddenException({
        code: 'ACCOUNT_MERGE_002',
        message: '계정 병합을 처리할 권한이 없습니다.',
      });
    }
  }

  /**
   * 병합 요청이 만료되지 않았는지 확인
   */
  static validateNotExpired(request: AccountMergeEntity): void {
    const hoursSinceCreation =
      (Date.now() - request.createdAt.getTime()) / this.MS_PER_HOUR;

    if (hoursSinceCreation > this.EXPIRATION_HOURS) {
      throw new BadRequestException({
        code: 'ACCOUNT_MERGE_004',
        message: '병합 요청이 만료되었습니다.',
      });
    }
  }

  /**
   * 상태가 특정 상태인지 확인
   */
  static validateStatus(
    request: AccountMergeEntity,
    expectedStatus: AccountMergeStatus,
    errorCode: string,
    errorMessage: string
  ): void {
    if (request.status !== expectedStatus) {
      throw new BadRequestException({
        code: errorCode,
        message: errorMessage,
      });
    }
  }

  /**
   * confirm/reject 전 공통 검증
   */
  static validatePendingState(request: AccountMergeEntity): void {
    this.validateStatus(
      request,
      AccountMergeStatus.PENDING_EMAIL_VERIFICATION,
      'ACCOUNT_MERGE_003',
      '이미 처리되었거나 처리할 수 없는 병합 요청입니다.'
    );
  }

  /**
   * 상태 전환 유효성 검증 및 실행
   */
  static validateAndTransition(
    request: AccountMergeEntity,
    targetStatus: AccountMergeStatus
  ): void {
    if (!this.canTransition(request.status, targetStatus)) {
      throw new BadRequestException({
        code: 'ACCOUNT_MERGE_005',
        message: `상태를 ${request.status}에서 ${targetStatus}로 전환할 수 없습니다.`,
      });
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
