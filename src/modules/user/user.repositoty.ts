import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import type { Detail, SearchQuery, SearchResult } from '@krgeobuk/user/interfaces';

import { OAuthAccount } from '@modules/oauth/entities/index.js';

import { User } from './entities/user.entity.js';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource);
  }

  /**
   * 모든 엔티티를 조회합니다.
   * @returns 모든 엔티티 배열
   */
  async findUserProfile(id: string): Promise<Detail> {
    const userAlias = 'user';
    const oauthAccountAlias = 'oauthAccount';

    const qb = this.createQueryBuilder(userAlias)
      .leftJoin(OAuthAccount, oauthAccountAlias, `${oauthAccountAlias}.userId = ${userAlias}.id`)
      .addSelect(`${oauthAccountAlias}.provider`, 'provider')
      .andWhere(`${userAlias}.id = :id`, { id });

    // const qb = this.createQueryBuilder('user')
    //   .leftJoin(OAuthAccount, 'oauthAccount', 'oauthAccount.userId = user.id')
    //   .addSelect(['user.id', 'user.email', 'user.name', 'oauthAccount.provider']);

    // const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);
    const row = await qb.getRawOne();

    const data = {
      email: row[`${userAlias}_email`],
      name: row[`${userAlias}_name`],
      nickname: row[`${userAlias}_nickname`],
      profileImageUrl: row[`${userAlias}_profileImageUrl`],
      isIntegrated: row[`${userAlias}_isIntegrated`],
      isEmailVerified: row[`${userAlias}_isEmailVerified`],
      createdAt: row[`${userAlias}_createdAt`],
      provider: row[`${oauthAccountAlias}_provider`],
    };

    return data;
  }

  /**
   * 모든 엔티티를 조회합니다.
   * @returns 모든 엔티티 배열
   */
  async search(query: SearchQuery): Promise<PaginatedResult<SearchResult>> {
    const {
      email,
      name,
      nickname,
      provider,
      page = 1,
      limit = 30,
      sortOrder = 'DESC',
      sortBy = 'createdAt',
    } = query;
    const skip = (page - 1) * limit;

    const userAlias = 'user';
    const oauthAccountAlias = 'oauthAccount';

    const qb = this.createQueryBuilder(userAlias)
      .leftJoin(OAuthAccount, oauthAccountAlias, `${oauthAccountAlias}.userId = ${userAlias}.id`)
      .addSelect(`${oauthAccountAlias}.provider`, 'provider'); // 필요한 경우만 선택
    // const qb = this.createQueryBuilder(userAlias).leftJoinAndSelect(
    //   `${userAlias}.${oauthAccountAlias}`,
    //   oauthAccountAlias
    // );

    // const qb = this.createQueryBuilder('user')
    //   .leftJoin(OAuthAccount, 'oauthAccount', 'oauthAccount.userId = user.id')
    //   .addSelect(['user.id', 'user.email', 'user.name', 'oauthAccount.provider']);

    if (email) {
      qb.andWhere(`${userAlias}.email LIKE :email`, { email: `%${email}%` });
    }
    if (name) {
      qb.andWhere(`${userAlias}.name LIKE :name`, { name: `%${name}%` });
    }
    if (nickname) {
      qb.andWhere(`${userAlias}.nickname LIKE :nickname`, {
        nickname: `%${nickname}%`,
      });
    }
    if (provider) {
      qb.andWhere(`${oauthAccountAlias}.provider = :provider`, { provider });
    }

    // 특정 역할 필터링 (e.g., 'admin', 'user')
    // if (role) {
    //   qb.andWhere(`${userAlias}.role = :role`, { role });
    // }

    qb.orderBy(`${userAlias}.${sortBy}`, sortOrder);

    qb.skip(skip).take(limit);

    const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

    const items = rows.map((row) => ({
      id: row[`${userAlias}_id`],
      email: row[`${userAlias}_email`],
      name: row[`${userAlias}_name`],
      nickname: row[`${userAlias}_nickname`],
      profileImageUrl: row[`${userAlias}_profileImageUrl`],
      isIntegrated: row[`${userAlias}_isIntegrated`],
      isEmailVerified: row[`${userAlias}_isEmailVerified`],
      createdAt: row[`${userAlias}_createdAt`],
      updatedAt: row[`${userAlias}_updatedAt`],
      deletedAt: row[`${userAlias}_deletedAt`],
      provider: row[`${oauthAccountAlias}_provider`],
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
