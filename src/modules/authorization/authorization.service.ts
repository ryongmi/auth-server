import { Injectable } from '@nestjs/common';
// import { EntityManager } from 'typeorm';

// import type { PaginatedResult } from '@krgeobuk/core/interfaces';
// import type { ListQuery } from '@krgeobuk/user/interfaces';

import { DataSource } from 'typeorm';

@Injectable()
export class AuthorizationService {
  constructor(private readonly dataSource: DataSource) {}

  // async findUsers(query: ListQuery): Promise<PaginatedResult<Partial<User>>> {
  //   return this.userRepo.findAllWithFilters(query);
  // }

  // async findUserById(id: string): Promise<User> {
  //   return this.userRepo.findOneByIdOrFail(id);
  // }

  // async findUserByEmail(email: string | null): Promise<User | null> {
  //   if (!email) {
  //     return null;
  //   }

  //   return this.userRepo.findOne({
  //     where: { email },
  //   });
  // }

  // async findUsersByUsername(name: string): Promise<User[] | undefined> {
  //   return this.userRepo.find({ where: { name } });
  // }

  // async findUserByUserIdOREmail(id: string, email: string): Promise<User[] | undefined> {
  //   return this.userRepo.find({ where: [{ id }, { email }] });
  // }

  // async lastLoginUpdate(id: string) {
  //   // return await this.repo.save(attrs);
  //   // await this.repo
  //   //   .createQueryBuilder()
  //   //   .update(User)
  //   //   .set({ lastLogin: new Date() })
  //   //   .where('id = :id', { id })
  //   //   .execute();
  // }

  // async createUser(attrs: Partial<User>, transactionManager?: EntityManager): Promise<User> {
  //   const userEntity = new User();

  //   Object.assign(userEntity, attrs);

  //   return this.userRepo.saveEntity(userEntity, transactionManager);
  // }

  // async updateUser(userEntity: User, transactionManager?: EntityManager): Promise<User> {
  //   return this.userRepo.saveEntity(userEntity, transactionManager);
  // }
}
