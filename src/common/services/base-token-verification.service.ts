import { Logger } from '@nestjs/common';

import { UserException } from '@krgeobuk/user/exception';

import { RedisService } from '@database/redis/redis.service.js';
import { UserService } from '@modules/user/index.js';
import { EmailTokenService, EmailTokenType } from '@common/email/index.js';
import type { UserEntity } from '@modules/user/entities/user.entity.js';

/**
 * 토큰 검증 기반 서비스의 추상 클래스
 * 이메일 인증, 비밀번호 재설정 등 토큰 기반 작업의 공통 로직 제공
 * @template T - processUserVerification에 전달될 추가 데이터의 타입
 */
export abstract class BaseTokenVerificationService<T = void> {
  protected abstract readonly logger: Logger;

  constructor(
    protected readonly redisService: RedisService,
    protected readonly userService: UserService,
    protected readonly emailTokenService: EmailTokenService
  ) {}

  /**
   * 토큰 요청 시 사용자 검증 (추상 메서드)
   * @param user - 검증할 사용자 엔티티
   * @throws 검증 실패 시 예외 발생
   */
  protected abstract validateUserForRequest(user: UserEntity): void | Promise<void>;

  /**
   * 토큰 검증 후 사용자 처리 (추상 메서드)
   * @param user - 처리할 사용자 엔티티
   * @param additionalData - 추가 데이터 (예: 새 비밀번호)
   */
  protected abstract processUserVerification(user: UserEntity, additionalData?: T): Promise<void>;

  /**
   * 토큰 요청 공통 로직
   * @param email - 사용자 이메일
   * @param tokenType - 토큰 타입
   * @param methodName - 로깅용 메서드 이름
   */
  protected async requestToken(
    email: string,
    tokenType: EmailTokenType,
    methodName: string
  ): Promise<void> {
    this.logger.log(`${methodName} - 시작되었습니다.`);

    // 사용자 존재 확인
    const user = (await this.userService.findByAnd({ email }))[0];
    if (!user) {
      throw UserException.userNotFound();
    }

    // 사용자 검증 (하위 클래스에서 구현)
    await this.validateUserForRequest(user);

    // 토큰 생성 및 이메일 발송
    await this.emailTokenService.generateAndSendToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      tokenType,
    });

    this.logger.log(`${methodName} - 인증 이메일 발송 완료`);
  }

  /**
   * 토큰 검증 공통 로직
   * @param token - 검증할 토큰
   * @param getTokenMethod - Redis에서 토큰 조회 메서드
   * @param deleteTokenMethod - Redis에서 토큰 삭제 메서드
   * @param methodName - 로깅용 메서드 이름
   * @param additionalData - 추가 데이터 (하위 클래스의 processUserVerification으로 전달)
   */
  protected async verifyToken(
    token: string,
    getTokenMethod: (token: string) => Promise<string | null>,
    deleteTokenMethod: (token: string) => Promise<void>,
    methodName: string,
    additionalData?: T
  ): Promise<void> {
    this.logger.log(`${methodName} - 시작되었습니다.`);

    // Redis에서 토큰 조회
    const userId = await getTokenMethod.call(this.redisService, token);
    if (!userId) {
      throw this.getTokenInvalidException();
    }

    // 사용자 조회
    const user = await this.userService.findById(userId);
    if (!user) {
      throw UserException.userNotFound();
    }

    // 사용자 처리 (하위 클래스에서 구현)
    await this.processUserVerification(user, additionalData);

    // 사용자 업데이트
    await this.userService.updateUser(user);

    // 토큰 삭제 (일회성)
    await deleteTokenMethod.call(this.redisService, token);

    this.logger.log(`${methodName} - 완료`, { userId });
  }

  /**
   * 토큰 무효화 예외 반환 (하위 클래스에서 오버라이드 가능)
   */
  protected abstract getTokenInvalidException(): Error;
}
