import { SetMetadata } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

export const TRANSACTION_KEY = 'TRANSACTION';

export function Transaction() {
  return function (
    target: any, // 데코레이터가 적용된 클래스의 prototype
    propertyKey: string, // 데코레이터가 적용된 메서드의 이름
    descriptor: PropertyDescriptor, // 메서드의 속성 설명자
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const dataSource: DataSource = this.dataSource;
      const queryRunner = dataSource.createQueryRunner();

      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const result = await originalMethod.apply(this, [
          ...args,
          queryRunner.manager,
        ]);
        await queryRunner.commitTransaction();
        return result;
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    };

    return descriptor;
  };
}
