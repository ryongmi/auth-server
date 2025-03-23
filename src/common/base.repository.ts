import { DataSource, EntityManager, ObjectType, Repository } from 'typeorm';

export abstract class BaseRepository<T> {
  protected constructor(
    protected readonly dataSource: DataSource,
    private readonly entityClass: ObjectType<T>,
  ) {}

  protected getRepository(entityManager?: EntityManager): Repository<T> {
    return entityManager
      ? entityManager.getRepository(this.entityClass)
      : this.dataSource.getRepository(this.entityClass);
  }

  // 다른 엔티티의 Repository를 가져오는 유틸리티 메서드
  protected getOtherRepository<E>(
    entityClass: ObjectType<E>,
    entityManager?: EntityManager,
  ): Repository<E> {
    return entityManager
      ? entityManager.getRepository(entityClass)
      : this.dataSource.getRepository(entityClass);
  }
}
