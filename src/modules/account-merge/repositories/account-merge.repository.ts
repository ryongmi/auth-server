import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { AccountMergeEntity } from '../entities/account-merge.entity.js';

@Injectable()
export class AccountMergeRepository extends BaseRepository<AccountMergeEntity> {
  constructor(private dataSource: DataSource) {
    super(AccountMergeEntity, dataSource);
  }

  /**
   * 병합 요청 ID로 조회
   */
  async findMergeById(id: number): Promise<AccountMergeEntity | null> {
    return await this.dataSource.getRepository(AccountMergeEntity).findOne({ where: { id } });
  }

  /**
   * 사용자 ID로 병합 요청 조회
   */
  async findMergesByUserId(userId: string): Promise<AccountMergeEntity[]> {
    return await this.dataSource.getRepository(AccountMergeEntity).find({
      where: [{ targetUserId: userId }, { sourceUserId: userId }],
      order: { createdAt: 'DESC' },
    });
  }
}
