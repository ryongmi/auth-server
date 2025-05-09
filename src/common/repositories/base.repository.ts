import {
  Repository,
  FindOptionsWhere,
  EntityTarget,
  SelectQueryBuilder,
} from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserQueryDto } from 'src/modules/user/dtos';

export class BaseRepository<T> extends Repository<T> {
  constructor(entity: EntityTarget<T>, dataSource: DataSource) {
    super(entity, dataSource.createEntityManager());
  }

  /**
   * ID로 엔티티 하나를 조회합니다.
   * @param id 엔티티 ID
   * @returns 찾은 엔티티
   */
  async findOneById(id: number | string): Promise<T | undefined> {
    const where = { id } as unknown as FindOptionsWhere<T>;
    return this.findOne({ where });
  }

  /**
   * ID로 엔티티 하나를 조회하고 없으면 예외를 발생시킵니다.
   * @param id 엔티티 ID
   * @returns 찾은 엔티티
   * @throws NotFoundException 엔티티를 찾지 못한 경우
   */
  async findOneByIdOrFail(id: number | string): Promise<T> {
    const entity = await this.findOneById(id);

    if (!entity) {
      throw new NotFoundException(
        `${this.metadata.name} with ID ${id} not found`,
      );
    }

    return entity;
  }

  /**
   * 모든 엔티티를 조회합니다.
   * @returns 모든 엔티티 배열
   */
  async findAll(
    query: UserQueryDto,
    alias: string,
  ): Promise<{ items: T[]; total: number; page: number; limit: number }> {
    const { page, limit, sortOrder, sortBy } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await this.createQueryBuilder(alias)
      .orderBy(`${alias}.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
    };
      
  async findAll(): Promise<T[]> {
    return this.find();
  }

  // 쿼리 빌더로 복잡한 쿼리 작성
  protected getQueryBuilder(alias: string): SelectQueryBuilder<T> {
    return this.createQueryBuilder(alias);
  }
}
