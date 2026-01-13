import { Injectable, Logger } from '@nestjs/common';

import { EntityManager, FindOptionsWhere, In, UpdateResult } from 'typeorm';

import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';
import type { OAuthAccountFilter } from '@krgeobuk/oauth/interfaces';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';
import { OAuthRepository } from './oauth.repository.js';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(private readonly oauthRepo: OAuthRepository) {}

  async findById(id: string): Promise<OAuthAccountEntity | null> {
    return this.oauthRepo.findOneById(id);
  }

  async findByUserIds(userIds: string[]): Promise<OAuthAccountEntity[]> {
    return this.oauthRepo.find({ where: { userId: In(userIds) } });
  }

  async findByAnd(filter: OAuthAccountFilter = {}): Promise<OAuthAccountEntity[]> {
    const where: FindOptionsWhere<OAuthAccountEntity> = {};

    if (filter.userId) where.userId = filter.userId;
    if (filter.provider) where.provider = filter.provider;
    if (filter.providerId) where.providerId = filter.providerId;

    // ✅ 필터 없으면 전체 조회
    if (Object.keys(where).length === 0) {
      return this.oauthRepo.find(); // 조건 없이 전체 조회
    }

    return this.oauthRepo.find({ where });
  }

  async findByOr(filter: OAuthAccountFilter = {}): Promise<OAuthAccountEntity[]> {
    const { userId, provider, providerId } = filter;

    const where: FindOptionsWhere<OAuthAccountEntity>[] = [];

    if (userId) where.push({ userId });
    if (provider) where.push({ provider });
    if (providerId) where.push({ providerId });

    // ✅ 필터 없으면 전체 조회
    if (where.length === 0) {
      return this.oauthRepo.find(); // 조건 없이 전체 조회
    }

    return this.oauthRepo.find({ where });
  }

  async createOAuthAccount(
    attrs: Partial<OAuthAccountEntity>,
    transactionManager?: EntityManager
  ): Promise<OAuthAccountEntity> {
    const oauthAccountEntity = new OAuthAccountEntity();

    Object.assign(oauthAccountEntity, attrs);

    return this.oauthRepo.saveEntity(oauthAccountEntity, transactionManager);
  }

  async updateOAuthAccount(
    oauthAccountEntity: OAuthAccountEntity,
    transactionManager?: EntityManager
  ): Promise<UpdateResult> {
    return this.oauthRepo.updateEntity(oauthAccountEntity, transactionManager);
  }

  /**
   * OAuth 계정 이전
   * sourceUser의 OAuth 계정을 targetUser로 이전
   *
   * @param sourceUserId - 원본 사용자 ID
   * @param targetUserId - 대상 사용자 ID
   * @param provider - OAuth 제공자
   * @param providerId - OAuth 제공자의 사용자 ID
   */
  async transferOAuthAccount(
    sourceUserId: string,
    targetUserId: string,
    provider: OAuthAccountProviderType,
    providerId: string
  ): Promise<void> {
    this.logger.log('Transferring OAuth account', {
      from: sourceUserId,
      to: targetUserId,
      provider,
      providerId,
    });

    const result = await this.oauthRepo.update(
      { userId: sourceUserId, provider, providerId },
      { userId: targetUserId }
    );

    if (result.affected === 0) {
      throw new Error('OAuth account not found for transfer');
    }

    this.logger.log('OAuth account transferred successfully');
  }


  /**
   * OAuth 계정 복원
   * 보상 트랜잭션에서 사용 - 병합 실패 시 OAuth 계정 복원
   *
   * @param account - 복원할 OAuth 계정 정보
   */
  async restore(account: Partial<OAuthAccountEntity>): Promise<void> {
    this.logger.log('Restoring OAuth account', {
      userId: account.userId,
      provider: account.provider,
    });

    await this.oauthRepo.save(account);

    this.logger.log('OAuth account restored');
  }
}
