import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { OAuthAccount } from './entities/oauth-account.entity.js';

@Injectable()
export class OAuthRepository extends BaseRepository<OAuthAccount> {
  constructor(private dataSource: DataSource) {
    super(OAuthAccount, dataSource);
  }

  async findOAuthAccountByUserId(userId: string): Promise<OAuthAccount | null> {
    return await this.dataSource.getRepository(OAuthAccount).findOne({ where: { userId } });
  }

  async createOAuthAccountByTransaction(
    transactionManager: EntityManager,
    attrs: Partial<OAuthAccount>
  ): Promise<OAuthAccount> {
    const account = transactionManager.getRepository(OAuthAccount).create(attrs);
    return await transactionManager.getRepository(OAuthAccount).save(account);
  }
}
