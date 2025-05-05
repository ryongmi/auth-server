import { Injectable } from '@nestjs/common';
import { User } from '../user/entities';
import { EntityManager } from 'typeorm';
import { UserRepository } from './user.repositoty';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async findAll(): Promise<User[]> {
    return this.userRepo.findAll();
  }

  async findById(id: number): Promise<User> {
    return this.userRepo.findOneByIdOrFail(id);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findByUsername(name: string): Promise<User[] | undefined> {
    return this.userRepo.find({ where: { name } });
  }

  async findByUserIdOREmail(
    id: string,
    email: string,
  ): Promise<User[] | undefined> {
    return this.userRepo.find({ where: [{ id }, { email }] });
  }

  // async lastLoginUpdate(id: string) {
  //   // return await this.repo.save(attrs);
  //   // await this.repo
  //   //   .createQueryBuilder()
  //   //   .update(User)
  //   //   .set({ lastLogin: new Date() })
  //   //   .where('id = :id', { id })
  //   //   .execute();
  // }

  async createUser(
    transactionManager: EntityManager,
    attrs: Partial<User>,
  ): Promise<User> {
    const user = await transactionManager.getRepository(User).create(attrs);
    return this.userRepo.save(user);
  }

  async updateUser(id: string, attrs: Partial<User>): Promise<User> {
    const user = await this.userRepo.findOneByIdOrFail(id);
    const updatedUser = this.userRepo.merge(user, attrs);
    return this.userRepo.save(updatedUser);
  }

  async updateUserByTransaction(
    transactionManager: EntityManager,
    attrs: Partial<User>,
  ): Promise<User> {
    return await transactionManager.getRepository(User).save(attrs);
  }
}
