import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { OAuthAccount } from './entities/oauth-account.entity.js';

@Injectable()
export class OAuthRepository extends BaseRepository<OAuthAccount> {
  constructor(private dataSource: DataSource) {
    super(OAuthAccount, dataSource);
  }

  //   await this.dataSource.transaction(async (manager) => {
  //   const userRepo = manager.withRepository(UserRepository);
  //   await userRepo.findAllWithFilters(...); // ✅ 커스텀 메서드 사용 가능
  // });

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

  // async findAllWithFilters(
  //   query: UserQueryDto
  // ): Promise<{ items: User[]; total: number; page: number; limit: number }> {
  //   const { email, name, nickname, provider, page, limit, sortOrder, sortBy } = query;
  //   const skip = (page - 1) * limit;

  //   const userAlias = 'user';
  //   const oauthAccountAlias = 'oauthAccount';

  //   const qb = this.createQueryBuilder(userAlias)
  //     .leftJoin(OAuthAccount, oauthAccountAlias, `${oauthAccountAlias}.userId = ${userAlias}.id`)
  //     .addSelect(`${oauthAccountAlias}.provider`, 'provider'); // 필요한 경우만 선택
  //   // const qb = this.createQueryBuilder(userAlias).leftJoinAndSelect(
  //   //   `${userAlias}.${oauthAccountAlias}`,
  //   //   oauthAccountAlias
  //   // );

  //   // const qb = this.createQueryBuilder('user')
  //   //   .leftJoin(OAuthAccount, 'oauthAccount', 'oauthAccount.userId = user.id')
  //   //   .addSelect(['user.id', 'user.email', 'user.name', 'oauthAccount.provider']);

  //   if (email) {
  //     qb.andWhere(`${userAlias}.email LIKE :email`, { email: `%${email}%` });
  //   }
  //   if (name) {
  //     qb.andWhere(`${userAlias}.name LIKE :name`, { name: `%${name}%` });
  //   }
  //   if (nickname) {
  //     qb.andWhere(`${userAlias}.nickname LIKE :nickname`, {
  //       nickname: `%${nickname}%`,
  //     });
  //   }
  //   if (provider) {
  //     qb.andWhere(`${oauthAccountAlias}.provider = :provider`, { provider });
  //   }

  //   // 특정 역할 필터링 (e.g., 'admin', 'user')
  //   // if (role) {
  //   //   qb.andWhere(`${userAlias}.role = :role`, { role });
  //   // }

  //   qb.orderBy(`${userAlias}.${sortBy}`, sortOrder).skip(skip).take(limit);

  //   // const [items, total] = await qb
  //   //   .orderBy(`${userAlias}.${sortBy}`, sortOrder)
  //   //   .skip(skip)
  //   //   .take(limit)
  //   //   .getManyAndCount();

  //   const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

  //   const items = rows.map((row) => ({
  //     id: row[`${userAlias}_id`],
  //     email: row[`${userAlias}_email`],
  //     name: row[`${userAlias}_name`],
  //     nickname: row[`${userAlias}_nickname`],
  //     provider: row[`${oauthAccountAlias}_provider`],
  //   }));

  //   return {
  //     items,
  //     total,
  //     page,
  //     limit,
  //   };
  // }
}
