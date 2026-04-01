import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import type { UserDetail, UserSearchQuery, UserSearchResult } from '@krgeobuk/user/interfaces';

import { OAuthAccountEntity } from '@modules/oauth/entities/index.js';

import { UserEntity } from './entities/user.entity.js';

@Injectable()
export class UserRepository extends BaseRepository<UserEntity> {
  constructor(private dataSource: DataSource) {
    super(UserEntity, dataSource);
  }

  /**
   * 모든 엔티티를 조회합니다.
   * @returns 모든 엔티티 배열
   */
  async findUserProfile(id: string): Promise<UserDetail> {
    const userAlias = 'user';
    const oauthAccountAlias = 'oauthAccount';

    const qb = this.getQueryBuilder(userAlias)
      .select([
        `${userAlias}.id AS ${userAlias}_id`,
        `${userAlias}.email AS email`,
        `${userAlias}.name AS name`,
        `${userAlias}.nickname AS nickname`,
        `${userAlias}.profile_image_url AS profileImageUrl`,
        `${userAlias}.is_email_verified AS isEmailVerified`,
        `${userAlias}.created_at AS createdAt`,
      ])
      .leftJoin(
        OAuthAccountEntity,
        oauthAccountAlias,
        `${oauthAccountAlias}.userId = ${userAlias}.id`
      )
      .addSelect(`${oauthAccountAlias}.id AS ${oauthAccountAlias}_id`)
      .addSelect(`${oauthAccountAlias}.provider AS provider`)
      .andWhere(`${userAlias}.id = :id`, { id });

    const rows = await qb.getRawMany();

    const first = rows[0];

    const data = {
      id: first[`${userAlias}_id`],
      email: first[`email`],
      name: first[`name`],
      nickname: first[`nickname`],
      profileImageUrl: first[`profileImageUrl`],
      isEmailVerified: first[`isEmailVerified`],
      createdAt: first[`createdAt`],
      oauthAccounts: rows
        .filter((row) => row[`${oauthAccountAlias}_id`] !== null)
        .map((row) => ({
          id: row[`${oauthAccountAlias}_id`],
          provider: row[`provider`],
        })),
    };

    return data;
  }

  /**
   * 모든 엔티티를 조회합니다.
   * @returns 모든 엔티티 배열
   */
  async search(query: UserSearchQuery): Promise<PaginatedResult<UserSearchResult>> {
    const {
      email,
      name,
      nickname,
      provider,
      page = 1,
      limit = LimitType.FIFTEEN,
      sortOrder = SortOrderType.DESC,
      sortBy = 'createdAt',
    } = query;
    const skip = (page - 1) * limit;

    const userAlias = 'user';
    const oauthAccountAlias = 'oauthAccount';

    const applyFilters = (qb: ReturnType<typeof this.getQueryBuilder>): void => {
      if (email) {
        if (email.includes('@')) {
          qb.andWhere(`${userAlias}.email = :email`, { email });
        } else {
          qb.andWhere(`${userAlias}.email LIKE :email`, { email: `${email}%` });
        }
      }
      if (name) qb.andWhere(`${userAlias}.name LIKE :name`, { name: `%${name}%` });
      if (nickname) qb.andWhere(`${userAlias}.nickname LIKE :nickname`, { nickname: `%${nickname}%` });
      if (provider) qb.andWhere(`${oauthAccountAlias}.provider = :provider`, { provider });
    };

    // total count용 쿼리 (user 기준 distinct)
    const countQb = this.getQueryBuilder(userAlias)
      .leftJoin(OAuthAccountEntity, oauthAccountAlias, `${oauthAccountAlias}.userId = ${userAlias}.id`);
    applyFilters(countQb);

    // pagination을 user 기준으로 적용하기 위해 id 목록 추출
    const pagedIdsQb = this.getQueryBuilder(userAlias)
      .select(`${userAlias}.id AS user_id`)
      .leftJoin(OAuthAccountEntity, oauthAccountAlias, `${oauthAccountAlias}.userId = ${userAlias}.id`)
      .groupBy(`${userAlias}.id`)
      .orderBy(`${userAlias}.${sortBy}`, sortOrder)
      .offset(skip)
      .limit(limit);
    applyFilters(pagedIdsQb);

    const pagedUserIds: Array<{ user_id: string }> = await pagedIdsQb.getRawMany();

    const userIds = pagedUserIds.map((r) => r[`user_id`]);

    const [rows, total] = await Promise.all([
      userIds.length > 0
        ? this.getQueryBuilder(userAlias)
            .select([
              `${userAlias}.id AS ${userAlias}_id`,
              `${userAlias}.email AS email`,
              `${userAlias}.name AS name`,
              `${userAlias}.nickname AS nickname`,
              `${userAlias}.profile_image_url AS profileImageUrl`,
              `${userAlias}.is_email_verified AS isEmailVerified`,
              `${userAlias}.created_at AS createdAt`,
              `${userAlias}.updated_at AS updatedAt`,
            ])
            .leftJoin(OAuthAccountEntity, oauthAccountAlias, `${oauthAccountAlias}.userId = ${userAlias}.id`)
            .addSelect(`${oauthAccountAlias}.id AS ${oauthAccountAlias}_id`)
            .addSelect(`${oauthAccountAlias}.provider AS provider`)
            .whereInIds(userIds)
            .orderBy(`${userAlias}.${sortBy}`, sortOrder)
            .getRawMany()
        : Promise.resolve([]),
      countQb.select(`COUNT(DISTINCT ${userAlias}.id)`).getCount(),
    ]);

    // user별로 oauthAccounts 집계
    const userMap = new Map<string, UserSearchResult>();
    for (const row of rows) {
      const userId = row[`${userAlias}_id`] as string;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: userId,
          email: row[`email`],
          name: row[`name`],
          nickname: row[`nickname`],
          profileImageUrl: row[`profileImageUrl`],
          isEmailVerified: row[`isEmailVerified`],
          createdAt: row[`createdAt`],
          oauthAccounts: [],
        });
      }
      if (row[`${oauthAccountAlias}_id`] !== null) {
        userMap.get(userId)!.oauthAccounts.push({
          id: row[`${oauthAccountAlias}_id`],
          provider: row[`provider`],
        });
      }
    }

    // 원래 정렬 순서 유지
    const items = userIds.map((id) => userMap.get(id)).filter((u): u is UserSearchResult => u !== undefined);

    const totalPages = Math.ceil(total / limit);
    const pageInfo = {
      page,
      limit,
      totalItems: total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    };

    return {
      items,
      pageInfo,
    };
  }
}
