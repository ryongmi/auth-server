import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { AccountMergeRequestEntity } from './entities/account-merge-request.entity.js';

@Injectable()
export class AccountMergeRequestRepository extends BaseRepository<AccountMergeRequestEntity> {
  constructor(private dataSource: DataSource) {
    super(AccountMergeRequestEntity, dataSource);
  }

  /**
   * 병합 요청 ID로 조회
   */
  async findMergeRequestById(requestId: number): Promise<AccountMergeRequestEntity | null> {
    return await this.dataSource
      .getRepository(AccountMergeRequestEntity)
      .findOne({ where: { id: requestId } });
  }

  /**
   * 사용자 ID로 병합 요청 조회
   */
  async findMergeRequestsByUserId(userId: string): Promise<AccountMergeRequestEntity[]> {
    return await this.dataSource.getRepository(AccountMergeRequestEntity).find({
      where: [{ targetUserId: userId }, { sourceUserId: userId }],
      order: { createdAt: 'DESC' },
    });
  }
}
