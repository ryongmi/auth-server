import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { firstValueFrom, timeout } from 'rxjs';

import { BaseSagaOrchestrator, SagaStep, RetryOptions } from '@krgeobuk/saga';
import { UserRoleTcpPatterns } from '@krgeobuk/user-role/tcp/patterns';
import { AccountMergeTcpPatterns } from '@krgeobuk/account-merge/tcp/patterns';
import type { MyPickSnapshotData } from '@krgeobuk/account-merge/tcp/interfaces';

import {
  DEFAULT_TCP_TIMEOUT_MS,
  MYPICK_TCP_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  CACHE_MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  SNAPSHOT_RETENTION_SECONDS,
} from '@common/constants/index.js';
import { UserService } from '@modules/user/user.service.js';
import { OAuthService } from '@modules/oauth/oauth.service.js';
import { RedisService } from '@database/redis/redis.service.js';

import { AccountMergeEntity } from './entities/account-merge.entity.js';
import type { MergeSnapshot } from './interface/merge-snapshot.interface.js';

/**
 * 계정 병합 오케스트레이터
 *
 * Saga 패턴을 사용하여 다음 5단계를 순차 실행:
 * 1. STEP1_AUTH_BACKUP: OAuth 계정 이전
 * 2. STEP2_AUTHZ_MERGE: 역할/권한 병합 (authz-server TCP)
 * 3. STEP3_MYPICK_MERGE: my-pick 데이터 병합 (my-pick-server TCP)
 * 4. STEP4_USER_DELETE: User B 소프트 삭제
 * 5. STEP5_CACHE_INVALIDATE: 캐시 무효화
 *
 * 실패 시 역순으로 보상 트랜잭션 실행
 */
@Injectable()
export class AccountMergeOrchestrator extends BaseSagaOrchestrator<
  AccountMergeEntity,
  MergeSnapshot
> {
  protected readonly logger = new Logger(AccountMergeOrchestrator.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    @Inject('AUTHZ_SERVICE') private readonly authzClient: ClientProxy,
    @Inject('MYPICK_SERVICE') private readonly myPickClient: ClientProxy
  ) {
    super();
  }

  /**
   * Saga 실행 단계 정의
   * 각 단계는 독립적으로 실행되며 실패 시 재시도
   */
  protected getSteps(): SagaStep<AccountMergeEntity>[] {
    const defaultRetryOptions: RetryOptions = {
      maxRetries: DEFAULT_MAX_RETRIES,
      baseDelayMs: RETRY_BASE_DELAY_MS,
      maxDelayMs: RETRY_MAX_DELAY_MS,
      timeoutMs: DEFAULT_TCP_TIMEOUT_MS,
    };

    return [
      {
        name: 'STEP1_AUTH_BACKUP',
        execute: (req: AccountMergeEntity) => this.backupAndMergeOAuth(req),
        retryOptions: defaultRetryOptions,
        onRetry: (attempt: number, error: unknown) =>
          this.logRetry('STEP1_AUTH_BACKUP', attempt, error),
      },
      {
        name: 'STEP2_AUTHZ_MERGE',
        execute: (req: AccountMergeEntity) => this.mergeRoles(req),
        retryOptions: defaultRetryOptions,
        onRetry: (attempt: number, error: unknown) =>
          this.logRetry('STEP2_AUTHZ_MERGE', attempt, error),
      },
      {
        name: 'STEP3_MYPICK_MERGE',
        execute: (req: AccountMergeEntity) => this.mergeMyPickData(req),
        retryOptions: { ...defaultRetryOptions, timeoutMs: MYPICK_TCP_TIMEOUT_MS },
        onRetry: (attempt: number, error: unknown) =>
          this.logRetry('STEP3_MYPICK_MERGE', attempt, error),
      },
      {
        name: 'STEP4_USER_DELETE',
        execute: (req: AccountMergeEntity) => this.softDeleteUser(req),
        retryOptions: defaultRetryOptions,
        onRetry: (attempt: number, error: unknown) =>
          this.logRetry('STEP4_USER_DELETE', attempt, error),
      },
      {
        name: 'STEP5_CACHE_INVALIDATE',
        execute: (req: AccountMergeEntity) => this.invalidateCache(req),
        retryOptions: { ...defaultRetryOptions, maxRetries: CACHE_MAX_RETRIES },
        onRetry: (attempt: number, error: unknown) =>
          this.logRetry('STEP5_CACHE_INVALIDATE', attempt, error),
      },
    ];
  }

  /**
   * 병합 전 상태 스냅샷 생성
   * Redis에 7일간 보관하여 롤백 시 사용
   */
  protected async createSnapshot(request: AccountMergeEntity): Promise<MergeSnapshot> {
    this.logger.log('Creating merge snapshot', {
      targetUserId: request.targetUserId,
      sourceUserId: request.sourceUserId,
    });

    const sourceUser = await this.userService.findById(request.sourceUserId);
    if (!sourceUser) {
      throw new Error(`Source user not found: ${request.sourceUserId}`);
    }

    const sourceOAuthAccounts = await this.oauthService.findByAnd({ userId: request.sourceUserId });

    // authz-server에서 역할 ID 목록 조회
    const sourceRoleIds = await firstValueFrom(
      this.authzClient
        .send<string[]>(UserRoleTcpPatterns.FIND_ROLES_BY_USER, { userId: request.sourceUserId })
        .pipe(timeout(DEFAULT_TCP_TIMEOUT_MS))
    );

    // 스냅샷 생성 (my-pick 데이터는 STEP3에서 수집하여 업데이트)
    const snapshot: MergeSnapshot = {
      targetUserId: request.targetUserId,
      sourceUser,
      sourceOAuthAccounts,
      sourceRoleIds,
      sourceMyPickData: { sourceCreatorIds: [], sourceContentIds: [] },
      backupTimestamp: new Date(),
    };

    // Redis에 백업 저장
    await this.redisService.setMergeSnapshot(request.id, snapshot, SNAPSHOT_RETENTION_SECONDS);

    this.logger.log('Snapshot created and saved to Redis', {
      requestId: request.id,
      ttlSeconds: SNAPSHOT_RETENTION_SECONDS,
    });

    return snapshot;
  }

  /**
   * 보상 트랜잭션 실행
   * 완료된 단계를 역순으로 롤백
   */
  protected async compensate(completedSteps: string[], snapshot: MergeSnapshot): Promise<void> {
    this.logger.warn('Starting compensation transaction', {
      completedSteps,
      totalSteps: completedSteps.length,
    });

    for (const stepName of completedSteps) {
      try {
        switch (stepName) {
          case 'STEP5_CACHE_INVALIDATE':
            // 캐시 롤백 불필요 (재생성되므로)
            this.logger.log('Skipping cache invalidation rollback');
            break;

          case 'STEP4_USER_DELETE':
            await this.restoreUser(snapshot);
            break;

          case 'STEP3_MYPICK_MERGE':
            await this.rollbackMyPickMerge(snapshot);
            break;

          case 'STEP2_AUTHZ_MERGE':
            await this.rollbackRoleMerge(snapshot);
            break;

          case 'STEP1_AUTH_BACKUP':
            await this.restoreOAuthAccounts(snapshot);
            break;

          default:
            this.logger.warn(`Unknown step for compensation: ${stepName}`);
        }

        this.logger.log(`Compensation succeeded for ${stepName}`);
      } catch (error) {
        this.logger.error(`Compensation failed for ${stepName}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        // TODO: 관리자 알림 전송
      }
    }

    this.logger.warn('Compensation transaction completed');
  }

  // ==================== STEP 구현 ====================

  /**
   * STEP1: OAuth 계정 백업 및 병합
   * sourceUser의 OAuth 계정을 targetUser로 이전
   */
  private async backupAndMergeOAuth(request: AccountMergeEntity): Promise<void> {
    this.logger.log('Executing STEP1: OAuth account merge', {
      sourceUserId: request.sourceUserId,
      targetUserId: request.targetUserId,
      provider: request.provider,
    });

    // OAuth 계정을 sourceUser에서 targetUser로 이전
    await this.oauthService.transferOAuthAccount(
      request.sourceUserId,
      request.targetUserId,
      request.provider,
      request.providerId
    );

    this.logger.log('STEP1 completed: OAuth account transferred');
  }

  /**
   * STEP2: 역할/권한 병합
   * authz-server TCP를 통해 역할 병합 요청
   */
  private async mergeRoles(request: AccountMergeEntity): Promise<void> {
    this.logger.log('Executing STEP2: Role merge', {
      sourceUserId: request.sourceUserId,
      targetUserId: request.targetUserId,
    });

    await firstValueFrom(
      this.authzClient
        .send(UserRoleTcpPatterns.MERGE_USER_ROLES, {
          sourceUserId: request.sourceUserId,
          targetUserId: request.targetUserId,
        })
        .pipe(timeout(DEFAULT_TCP_TIMEOUT_MS))
    );

    this.logger.log('STEP2 completed: User roles merged');
  }

  /**
   * STEP3: my-pick 데이터 병합
   * my-pick-server TCP를 통해 데이터 병합 요청
   * 스냅샷 데이터를 받아서 Redis에 업데이트
   */
  private async mergeMyPickData(request: AccountMergeEntity): Promise<void> {
    this.logger.log('Executing STEP3: my-pick data merge', {
      sourceUserId: request.sourceUserId,
      targetUserId: request.targetUserId,
    });

    // my-pick-server에서 병합 실행 및 스냅샷 수신
    const myPickSnapshot = await firstValueFrom(
      this.myPickClient
        .send<MyPickSnapshotData>(AccountMergeTcpPatterns.MERGE_USER_DATA, {
          sourceUserId: request.sourceUserId,
          targetUserId: request.targetUserId,
        })
        .pipe(timeout(MYPICK_TCP_TIMEOUT_MS))
    );

    // Redis에 저장된 스냅샷 업데이트 (my-pick 데이터 추가)
    const existingSnapshot = await this.redisService.getMergeSnapshot(request.id);
    if (existingSnapshot) {
      existingSnapshot.sourceMyPickData = myPickSnapshot;
      await this.redisService.setMergeSnapshot(
        request.id,
        existingSnapshot,
        SNAPSHOT_RETENTION_SECONDS
      );
    }

    this.logger.log('STEP3 completed: my-pick data merged', {
      sourceCreatorIds: myPickSnapshot.sourceCreatorIds.length,
      sourceContentIds: myPickSnapshot.sourceContentIds.length,
    });
  }

  /**
   * STEP4: User B 소프트 삭제
   * deletedAt 타임스탬프 설정
   */
  private async softDeleteUser(request: AccountMergeEntity): Promise<void> {
    this.logger.log('Executing STEP4: User soft delete', {
      sourceUserId: request.sourceUserId,
    });

    await this.userService.deleteUser(request.sourceUserId);

    this.logger.log('STEP4 completed: User soft deleted');
  }

  /**
   * STEP5: 캐시 무효화
   * User A, B의 권한 캐시 삭제
   */
  private async invalidateCache(request: AccountMergeEntity): Promise<void> {
    this.logger.log('Executing STEP5: Cache invalidation', {
      sourceUserId: request.sourceUserId,
      targetUserId: request.targetUserId,
    });

    // User B 권한 캐시 삭제
    await this.redisService.deleteUserPermissionCache(request.sourceUserId);

    // User A 권한 캐시 삭제 (새 역할 반영)
    await this.redisService.deleteUserPermissionCache(request.targetUserId);

    this.logger.log('STEP5 completed: Cache invalidated');
  }

  // ==================== 보상 트랜잭션 ====================

  /**
   * User B 복원
   * soft delete 취소
   */
  private async restoreUser(snapshot: MergeSnapshot): Promise<void> {
    this.logger.log('Restoring user', { userId: snapshot.sourceUser.id });
    await this.userService.restoreUser(snapshot.sourceUser.id);
  }

  /**
   * my-pick 데이터 롤백
   * my-pick-server TCP를 통해 롤백 요청
   */
  private async rollbackMyPickMerge(snapshot: MergeSnapshot): Promise<void> {
    this.logger.log('Rolling back my-pick merge', {
      sourceUserId: snapshot.sourceUser.id,
      targetUserId: snapshot.targetUserId,
    });

    await firstValueFrom(
      this.myPickClient
        .send(AccountMergeTcpPatterns.ROLLBACK_MERGE, {
          sourceUserId: snapshot.sourceUser.id,
          targetUserId: snapshot.targetUserId,
          snapshot: snapshot.sourceMyPickData,
        })
        .pipe(timeout(MYPICK_TCP_TIMEOUT_MS))
    );

    this.logger.log('my-pick merge rollback completed');
  }

  /**
   * 역할 병합 롤백
   * authz-server TCP를 통해 롤백 요청
   */
  private async rollbackRoleMerge(snapshot: MergeSnapshot): Promise<void> {
    this.logger.log('Rolling back role merge', {
      sourceUserId: snapshot.sourceUser.id,
      targetUserId: snapshot.targetUserId,
      roleCount: snapshot.sourceRoleIds.length,
    });

    await firstValueFrom(
      this.authzClient
        .send(UserRoleTcpPatterns.ROLLBACK_MERGE, {
          sourceUserId: snapshot.sourceUser.id,
          targetUserId: snapshot.targetUserId,
          sourceRoleIds: snapshot.sourceRoleIds,
        })
        .pipe(timeout(DEFAULT_TCP_TIMEOUT_MS))
    );

    this.logger.log('Role merge rollback completed');
  }

  /**
   * OAuth 계정 복원
   * 스냅샷에서 OAuth 계정 정보를 복원
   */
  private async restoreOAuthAccounts(snapshot: MergeSnapshot): Promise<void> {
    this.logger.log('Restoring OAuth accounts', {
      count: snapshot.sourceOAuthAccounts.length,
    });

    for (const account of snapshot.sourceOAuthAccounts) {
      await this.oauthService.restore(account);
    }

    this.logger.log('OAuth accounts restored');
  }

  // ==================== 유틸리티 ====================

  /**
   * 재시도 로그 기록
   */
  private async logRetry(stepName: string, attempt: number, error: unknown): Promise<void> {
    this.logger.warn(`Retry ${stepName} (attempt ${attempt})`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: error && typeof error === 'object' && 'code' in error ? error.code : '',
    });
  }
}
