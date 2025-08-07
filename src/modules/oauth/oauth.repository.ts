import { Injectable } from '@nestjs/common';

import { DataSource, EntityManager } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { OAuthAccountEntity } from './entities/oauth-account.entity.js';

@Injectable()
export class OAuthRepository extends BaseRepository<OAuthAccountEntity> {
  constructor(private dataSource: DataSource) {
    super(OAuthAccountEntity, dataSource);
  }

  async findOAuthAccountByUserId(userId: string): Promise<OAuthAccountEntity | null> {
    return await this.dataSource.getRepository(OAuthAccountEntity).findOne({ where: { userId } });
  }

  async createOAuthAccountByTransaction(
    transactionManager: EntityManager,
    attrs: Partial<OAuthAccountEntity>
  ): Promise<OAuthAccountEntity> {
    const account = transactionManager.getRepository(OAuthAccountEntity).create(attrs);
    return await transactionManager.getRepository(OAuthAccountEntity).save(account);
  }
}
