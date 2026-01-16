import { randomBytes } from 'crypto';

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import { AccountMergeStatus } from '@krgeobuk/shared/account-merge';
import { AccountMergeCode } from '@krgeobuk/account-merge/codes';
import { AccountMergeException } from '@krgeobuk/account-merge/exception';
import { OAuthException } from '@krgeobuk/oauth/exception';
import { UserException } from '@krgeobuk/user/exception';
import { EmailService } from '@krgeobuk/email';

import { DefaultConfig } from '@common/interfaces/config.interfaces.js';
import {
  MS_PER_HOUR,
  MERGE_REQUEST_EXPIRATION_HOURS,
  MERGE_REQUEST_EXPIRATION_SECONDS,
  MERGE_REQUEST_EXPIRATION_MS,
} from '@common/constants/index.js';
import { UserService } from '@modules/user/user.service.js';
import { OAuthService } from '@modules/oauth/oauth.service.js';
import { RedisService } from '@database/redis/redis.service.js';

import { AccountMergeEntity } from './entities/account-merge.entity.js';
import { AccountMergeRepository } from './repositories/account-merge.repository.js';
import { AccountMergeOrchestrator } from './account-merge.orchestrator.js';
import { MergeStateMachine } from './merge-state-machine.js';

@Injectable()
export class AccountMergeService {
  private readonly logger = new Logger(AccountMergeService.name);

  constructor(
    private readonly userService: UserService,
    private readonly accountMergeRepo: AccountMergeRepository,
    private readonly mergeOrchestrator: AccountMergeOrchestrator,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly oauthService: OAuthService
  ) {}

  /**
   * 계정 병합 요청 시작
   * User B가 이미 가입된 이메일(User A 소유)로 OAuth 로그인 시도 시
   *
   * @param provider - OAuth 제공자 (Google or Naver)
   * @param providerId - OAuth 제공자의 사용자 ID
   * @param email - 이메일 주소 (User A와 User B가 공유하는 이메일)
   * @param sourceUserId - User B (삭제될 계정, 새 OAuth로 로그인 시도한 사용자)
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

    // 1. 이메일로 User A (유지할 계정) 찾기
    const targetUser = await this.userService.findByEmail(email);
    if (!targetUser) {
      throw UserException.userNotFound();
    }

    // 2. User A와 User B가 같은 계정인지 확인
    if (sourceUserId === targetUser.id) {
      throw AccountMergeException.sameAccountMerge();
    }

    // 3. User A가 이미 해당 OAuth 계정을 소유하고 있는지 확인
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
      const hoursSinceRequest = (Date.now() - recentRequest.createdAt.getTime()) / MS_PER_HOUR;
      if (hoursSinceRequest < MERGE_REQUEST_EXPIRATION_HOURS) {
        this.logger.warn(`Duplicate merge request within ${MERGE_REQUEST_EXPIRATION_HOURS} hours`, {
          requestId: recentRequest.id,
          hoursSinceRequest,
        });
        // 기존 요청 ID 반환
        return recentRequest.id;
      }
    }

    // 5. 병합 요청 엔티티 생성
    const mergeRequest = this.accountMergeRepo.create({
      sourceUserId, // User B (삭제될 계정)
      targetUserId: targetUser.id, // User A (유지할 계정)
      provider,
      providerId,
      status: AccountMergeStatus.PENDING_EMAIL_VERIFICATION,
    });

    const savedRequest = await this.accountMergeRepo.save(mergeRequest);

    // 6. 병합 확인 이메일 발송 (실패 시 DB 롤백)
    try {
      await this.sendMergeConfirmationEmail(savedRequest);
    } catch (error) {
      // Redis 또는 이메일 발송 실패 시 DB 롤백
      this.logger.error('Failed to send merge confirmation email, rolling back', {
        requestId: savedRequest.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await this.accountMergeRepo.delete({ id: savedRequest.id });
      throw error;
    }

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
      throw AccountMergeException.requestNotFound();
    }

    this.logger.debug('Merge request retrieved', { requestId });
    return request;
  }

  /**
   * 계정 병합 확인 (User B가 승인)
   *
   * @param requestId - 병합 요청 ID
   * @param userId - User B의 ID (승인하는 사용자, 삭제될 계정)
   */
  async confirmAccountMerge(requestId: number, userId: string): Promise<void> {
    this.logger.log('Confirming account merge', {
      requestId,
      userId,
    });

    // 1. 병합 요청 조회
    const request = await this.getAccountMerge(requestId);

    // 2. 상태 머신을 통한 검증 (권한, 상태, 만료 시간)
    try {
      MergeStateMachine.validateConfirm(request, userId);
    } catch (error: unknown) {
      // 만료된 경우 상태를 CANCELLED로 변경하고 토큰 만료 에러 발생
      if (error instanceof BadRequestException) {
        const errorResponse = error.getResponse() as { code?: string };
        if (errorResponse.code === AccountMergeCode.REQUEST_EXPIRED) {
          await this.cancelMergeRequest(requestId);
          throw AccountMergeException.tokenInvalidOrExpired();
        }
      }
      throw error;
    }

    // 3. 상태를 IN_PROGRESS로 변경
    await this.startMergeProcess(requestId);

    // 4. AccountMergeOrchestrator를 통한 Saga 실행
    try {
      await this.mergeOrchestrator.execute(request);

      // 5. 성공 시 상태를 COMPLETED로 변경
      await this.completeMergeProcess(requestId);

      this.logger.log('Account merge completed successfully', { requestId });
    } catch (error: unknown) {
      // 6. 실패 시 상태를 FAILED로 변경
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.failMergeProcess(requestId, errorMessage, request.retryCount);

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
   * @param userId - User B의 ID (거부하는 사용자, 삭제될 계정)
   */
  async rejectAccountMerge(requestId: number, userId: string): Promise<void> {
    this.logger.log('Rejecting account merge', {
      requestId,
      userId,
    });

    // 1. 병합 요청 조회
    const request = await this.getAccountMerge(requestId);

    // 2. 상태 머신을 통한 검증 (권한, 상태)
    MergeStateMachine.validateReject(request, userId);

    // 3. 상태를 CANCELLED로 변경
    await this.cancelMergeRequest(requestId);

    this.logger.log('Account merge rejected', { requestId });
  }

  // ==================== 상태 업데이트 헬퍼 메서드 ====================

  /**
   * 병합 요청 취소
   */
  private async cancelMergeRequest(requestId: number): Promise<void> {
    await this.accountMergeRepo.update(
      { id: requestId },
      { status: AccountMergeStatus.CANCELLED }
    );
  }

  /**
   * 병합 프로세스 시작 (이메일 인증 완료)
   */
  private async startMergeProcess(requestId: number): Promise<void> {
    await this.accountMergeRepo.update(
      { id: requestId },
      {
        status: AccountMergeStatus.IN_PROGRESS,
        emailVerifiedAt: new Date(),
      }
    );
  }

  /**
   * 병합 프로세스 완료
   */
  private async completeMergeProcess(requestId: number): Promise<void> {
    await this.accountMergeRepo.update(
      { id: requestId },
      {
        status: AccountMergeStatus.COMPLETED,
        completedAt: new Date(),
      }
    );
  }

  /**
   * 병합 프로세스 실패
   */
  private async failMergeProcess(
    requestId: number,
    errorMessage: string,
    currentRetryCount: number
  ): Promise<void> {
    await this.accountMergeRepo.update(
      { id: requestId },
      {
        status: AccountMergeStatus.FAILED,
        errorMessage,
        retryCount: currentRetryCount + 1,
      }
    );
  }

  // ==================== 이메일 발송 ====================

  /**
   * User B에게 병합 확인 이메일 발송
   *
   * @param mergeRequest - 병합 요청 엔티티
   */
  private async sendMergeConfirmationEmail(mergeRequest: AccountMergeEntity): Promise<void> {
    this.logger.log('Sending merge confirmation email', {
      requestId: mergeRequest.id,
      sourceUserId: mergeRequest.sourceUserId,
    });

    // User A (유지할 계정)와 User B (삭제될 계정) 정보 조회
    const [targetUser, sourceUser] = await Promise.all([
      this.userService.findById(mergeRequest.targetUserId), // User A
      this.userService.findById(mergeRequest.sourceUserId), // User B
    ]);

    if (!targetUser || !sourceUser) {
      throw new Error('User not found for merge confirmation email');
    }

    // 확인 토큰 생성 - 랜덤 바이트 기반
    const confirmToken = randomBytes(32).toString('hex');

    // Redis에 토큰 저장
    try {
      await this.redisService.setMergeToken(
        mergeRequest.id,
        confirmToken,
        MERGE_REQUEST_EXPIRATION_SECONDS
      );
    } catch (error) {
      this.logger.error('Failed to save merge token to Redis', {
        requestId: mergeRequest.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw AccountMergeException.requestCreationFailed();
    }

    // 확인 URL 생성
    const authClientUrl = this.configService.get<DefaultConfig['authClientUrl']>('authClientUrl')!;
    const confirmUrl = `${authClientUrl}/oauth/merge/confirm?token=${confirmToken}`;

    // 만료 시간 계산
    const expiresAt = new Date(Date.now() + MERGE_REQUEST_EXPIRATION_MS).toLocaleString('ko-KR');

    // 이메일 발송
    await this.emailService.sendAccountMergeEmail({
      to: sourceUser.email,
      name: sourceUser.name || sourceUser.email,
      targetUserEmail: targetUser.email,
      provider: mergeRequest.provider,
      providerId: mergeRequest.providerId,
      confirmUrl,
      expiresAt,
    });

    this.logger.log('Merge confirmation email sent', {
      to: sourceUser.email,
      requestId: mergeRequest.id,
    });
  }
}
