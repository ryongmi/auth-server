import { Injectable, Logger, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { AccountMergeStatus } from '@krgeobuk/oauth/enum';
import { OAuthException } from '@krgeobuk/oauth/exception';
import { UserException } from '@krgeobuk/user/exception';

import { UserService } from '@modules/user/user.service.js';
import { OAuthService } from '@modules/oauth/oauth.service.js';

import { AccountMergeEntity } from './entities/account-merge.entity.js';
import { AccountMergeRepository } from './repositories/account-merge.repository.js';
import { AccountMergeOrchestrator } from './account-merge.orchestrator.js';

@Injectable()
export class AccountMergeService {
  private readonly logger = new Logger(AccountMergeService.name);

  constructor(
    private readonly userService: UserService,
    private readonly accountMergeRepo: AccountMergeRepository,
    private readonly mergeOrchestrator: AccountMergeOrchestrator,
    @Inject(forwardRef(() => OAuthService))
    private readonly oauthService: OAuthService
  ) {}

  /**
   * 계정 병합 요청 시작
   * User A가 이미 가입된 이메일로 다른 OAuth provider로 로그인 시도 시
   *
   * @param provider - OAuth 제공자 (Google or Naver)
   * @param providerId - OAuth 제공자의 사용자 ID
   * @param email - 이메일 주소 (User A와 User B가 공유하는 이메일)
   * @param sourceUserId - User A (새로운 OAuth 계정 소유자)
   * @returns 병합 요청 ID
   */
  async initiateAccountMerge(
    provider: OAuthAccountProviderType,
    providerId: string,
    email: string,
    sourceUserId: string
  ): Promise<number> {
    this.logger.log('Initiating account merge request', {
      provider,
      email,
      sourceUserId,
    });

    // 1. 이메일로 User B 찾기
    const targetUser = await this.userService.findByEmail(email);
    if (!targetUser) {
      throw UserException.userNotFound();
    }

    // 2. User A와 User B가 같은 계정인지 확인
    if (sourceUserId === targetUser.id) {
      throw new BadRequestException({
        code: 'ACCOUNT_MERGE_001',
        message: '동일한 계정을 병합할 수 없습니다.',
      });
    }

    // 3. User B가 이미 해당 OAuth 계정을 소유하고 있는지 확인
    const existingOAuth = await this.oauthService.findByAnd({
      userId: targetUser.id,
      provider,
      providerId,
    });
    if (existingOAuth.length > 0) {
      throw OAuthException.providerAlreadyLinked(provider);
    }

    // 4. 중복 병합 요청 확인 (24시간 이내)
    const recentRequest = await this.accountMergeRepo.findOne({
      where: {
        sourceUserId,
        targetUserId: targetUser.id,
        provider,
        status: AccountMergeStatus.PENDING_EMAIL_VERIFICATION,
      },
      order: { createdAt: 'DESC' },
    });

    if (recentRequest) {
      const hoursSinceRequest =
        (Date.now() - recentRequest.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceRequest < 24) {
        this.logger.warn('Duplicate merge request within 24 hours', {
          requestId: recentRequest.id,
          hoursSinceRequest,
        });
        // 기존 요청 ID 반환
        return recentRequest.id;
      }
    }

    // 5. 병합 요청 엔티티 생성
    const mergeRequest = this.accountMergeRepo.create({
      sourceUserId, // User A (새로운 OAuth 계정 소유자)
      targetUserId: targetUser.id, // User B (기존 계정 소유자)
      provider,
      providerId,
      status: AccountMergeStatus.PENDING_EMAIL_VERIFICATION,
    });

    const savedRequest = await this.accountMergeRepo.save(mergeRequest);

    // 6. User B에게 병합 확인 이메일 발송
    await this.oauthService.sendMergeConfirmationEmail(savedRequest);

    this.logger.log('Account merge request created', {
      requestId: savedRequest.id,
      sourceUserId,
      targetUserId: targetUser.id,
    });

    return savedRequest.id;
  }

  /**
   * 계정 병합 요청 조회
   *
   * @param requestId - 병합 요청 ID
   * @returns 병합 요청 정보
   */
  async getAccountMerge(requestId: number): Promise<AccountMergeEntity> {
    const request = await this.accountMergeRepo.findOneBy({ id: requestId });
    if (!request) {
      throw OAuthException.mergeRequestNotFound();
    }

    this.logger.debug('Merge request retrieved', { requestId });
    return request;
  }

  /**
   * 계정 병합 확인 (User B가 승인)
   *
   * @param requestId - 병합 요청 ID
   * @param userId - User B의 ID (확인하는 사용자)
   */
  async confirmAccountMerge(requestId: number, userId: string): Promise<void> {
    this.logger.log('Confirming account merge', {
      requestId,
      userId,
    });

    // 1. 병합 요청 조회
    const request = await this.getAccountMerge(requestId);

    // 2. User B가 맞는지 확인
    if (request.targetUserId !== userId) {
      throw new ForbiddenException({
        code: 'ACCOUNT_MERGE_002',
        message: '계정 병합을 승인할 권한이 없습니다.',
      });
    }

    // 3. 상태 확인 (PENDING_EMAIL_VERIFICATION만 승인 가능)
    if (request.status !== AccountMergeStatus.PENDING_EMAIL_VERIFICATION) {
      throw new BadRequestException({
        code: 'ACCOUNT_MERGE_003',
        message: '이미 처리되었거나 처리할 수 없는 병합 요청입니다.',
      });
    }

    // 4. 만료 시간 확인 (24시간)
    const hoursSinceCreation = (Date.now() - request.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      await this.accountMergeRepo.update(
        { id: requestId },
        { status: AccountMergeStatus.CANCELLED }
      );
      throw OAuthException.mergeTokenInvalidOrExpired();
    }

    // 5. 상태를 IN_PROGRESS로 변경
    await this.accountMergeRepo.update(
      { id: requestId },
      {
        status: AccountMergeStatus.IN_PROGRESS,
        emailVerifiedAt: new Date(),
      }
    );

    // 6. AccountMergeOrchestrator를 통한 Saga 실행
    try {
      await this.mergeOrchestrator.execute(request);

      // 7. 성공 시 상태를 COMPLETED로 변경
      await this.accountMergeRepo.update(
        { id: requestId },
        {
          status: AccountMergeStatus.COMPLETED,
          completedAt: new Date(),
        }
      );

      this.logger.log('Account merge completed successfully', { requestId });
    } catch (error: unknown) {
      // 8. 실패 시 상태를 FAILED로 변경
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.accountMergeRepo.update(
        { id: requestId },
        {
          status: AccountMergeStatus.FAILED,
          errorMessage,
          retryCount: request.retryCount + 1,
        }
      );

      this.logger.error('Account merge failed', {
        requestId,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * 계정 병합 거부 (User B가 거부)
   *
   * @param requestId - 병합 요청 ID
   * @param userId - User B의 ID (거부하는 사용자)
   */
  async rejectAccountMerge(requestId: number, userId: string): Promise<void> {
    this.logger.log('Rejecting account merge', {
      requestId,
      userId,
    });

    // 1. 병합 요청 조회
    const request = await this.getAccountMerge(requestId);

    // 2. User B가 맞는지 확인
    if (request.targetUserId !== userId) {
      throw new ForbiddenException({
        code: 'ACCOUNT_MERGE_002',
        message: '계정 병합을 거부할 권한이 없습니다.',
      });
    }

    // 3. 상태 확인 (PENDING_EMAIL_VERIFICATION만 거부 가능)
    if (request.status !== AccountMergeStatus.PENDING_EMAIL_VERIFICATION) {
      throw new BadRequestException({
        code: 'ACCOUNT_MERGE_003',
        message: '이미 처리되었거나 처리할 수 없는 병합 요청입니다.',
      });
    }

    // 4. 상태를 CANCELLED로 변경
    await this.accountMergeRepo.update(
      { id: requestId },
      { status: AccountMergeStatus.CANCELLED }
    );

    this.logger.log('Account merge rejected', { requestId });
  }
}
