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

    const qb = this.createQueryBuilder(userAlias)
      .select([
        `${userAlias}.id AS ${userAlias}_id`,
        `${userAlias}.email AS email`,
        `${userAlias}.name AS name`,
        `${userAlias}.nickname AS nickname`,
        `${userAlias}.profile_image_url AS profileImageUrl`,
        `${userAlias}.is_integrated AS isIntegrated`,
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

    // const qb = this.createQueryBuilder('user')
    //   .leftJoin(OAuthAccount, 'oauthAccount', 'oauthAccount.userId = user.id')
    //   .addSelect(['user.id', 'user.email', 'user.name', 'oauthAccount.provider']);

    // const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);
    const row = await qb.getRawOne();

    const data = {
      id: row[`${userAlias}_id`],
      email: row[`email`],
      name: row[`name`],
      nickname: row[`nickname`],
      profileImageUrl: row[`profileImageUrl`],
      isIntegrated: row[`isIntegrated`],
      isEmailVerified: row[`isEmailVerified`],
      createdAt: row[`createdAt`],
      oauthAccount: {
        id: row[`${oauthAccountAlias}_id`],
        provider: row[`provider`],
      },
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

    const qb = this.createQueryBuilder(userAlias)
      .select([
        `${userAlias}.id AS ${userAlias}_id`,
        `${userAlias}.email AS email`,
        `${userAlias}.name AS name`,
        `${userAlias}.nickname AS nickname`,
        `${userAlias}.profile_image_url AS profileImageUrl`,
        `${userAlias}.is_integrated AS isIntegrated`,
        `${userAlias}.is_email_verified AS isEmailVerified`,
        `${userAlias}.created_at AS createdAt`,
        `${userAlias}.updated_at AS updatedAt`,
      ])
      .leftJoin(
        OAuthAccountEntity,
        oauthAccountAlias,
        `${oauthAccountAlias}.userId = ${userAlias}.id`
      )
      .addSelect(`${oauthAccountAlias}.id AS ${oauthAccountAlias}_id`)
      .addSelect(`${oauthAccountAlias}.provider AS provider`);

    // if (email) {
    //   qb.andWhere(`${userAlias}.email LIKE :email`, { email: `%${email}%` });
    // }
    if (email) {
      if (email.includes('@')) {
        // 정확한 이메일 검색
        qb.andWhere(`${userAlias}.email = :email`, { email });
      } else {
        // 이메일 시작 부분 매칭 (인덱스 활용 가능)
        qb.andWhere(`${userAlias}.email LIKE :email`, { email: `${email}%` });
      }
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

    qb.offset(skip).limit(limit);

    const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

    const items = rows.map((row) => ({
      id: row[`${userAlias}_id`],
      email: row[`email`],
      name: row[`name`],
      nickname: row[`nickname`],
      profileImageUrl: row[`profileImageUrl`],
      isIntegrated: row[`isIntegrated`],
      isEmailVerified: row[`isEmailVerified`],
      createdAt: row[`createdAt`],
      updatedAt: row[`updatedAt`],
      oauthAccount: {
        id: row[`${oauthAccountAlias}_id`],
        provider: row[`provider`],
      },
    }));

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

