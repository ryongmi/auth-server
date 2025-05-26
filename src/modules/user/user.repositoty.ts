import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { User } from "./entities";
import { BaseRepository } from "../../common/repositories";
import { UserQueryDto } from "./dtos";

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource);
  }

  //   async updateUserPassword(
  //     id: string,
  //     password: string,
  //     changePassword: string,
  //   ): Promise<User> {
  //     const user = await this.findById(id);

  //     if (!user) {
  //       throw UserException.userNotFound();
  //     }

  //     const isExisted = await isExistedPassword(password);
  //     if (!isExisted) {
  //       throw UserException.userInfoNotExist();
  //     }

  //     const result = await isHashingPassword(changePassword);
  //     user.password = result;

  //     return await this.userRepo.save(user);
  //   }
  /**
   * 모든 엔티티를 조회합니다.
   * @returns 모든 엔티티 배열
   */
  async findAllWithFilters(
    query: UserQueryDto
  ): Promise<{ items: User[]; total: number; page: number; limit: number }> {
    const { email, name, nickname, provider, page, limit, sortOrder, sortBy } = query;
    const skip = (page - 1) * limit;

    const userAlias = "user";
    const oauthAccountAlias = "oauthAccount";

    const qb = this.createQueryBuilder(userAlias).leftJoinAndSelect(
      `${userAlias}.${oauthAccountAlias}`,
      oauthAccountAlias
    );

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

    const [items, total] = await qb
      .orderBy(`${userAlias}.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
    };
  }

  // 예시: 유저와 프로필을 조인해서 조회
  async findUserWithProfile(userId: string): Promise<User | null> {
    return this.getQueryBuilder("user")
      .leftJoinAndSelect("user.profile", "profile")
      .where("user.id = :userId", { userId })
      .getOne();
  }
}
