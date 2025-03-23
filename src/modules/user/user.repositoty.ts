import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { User } from './entities';
import { UserException } from 'src/exception';
import {
  isExistedPassword,
  isHashingPassword,
} from 'src/common/utils/hash-password';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return await this.userRepo.find();
  }

  async findById(id: string): Promise<User> {
    if (!id) return null;

    return await this.userRepo.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<User> {
    return await this.userRepo.findOneBy({ email });
  }

  ///// 쓸지 않을지 모름
  async findByIdOREmail(id: string, email: string): Promise<User[]> {
    return await this.userRepo.findBy([{ id }, { email }]);
  }

  async updateUser(attrs: Partial<User>): Promise<User> {
    return await this.userRepo.save(attrs);

    // if (!attrs.id) {
    //   await transactionManager
    //     .getRepository(User_Role)
    //     .save({ user_id: user.id });
    // }
  }

  async updateUserName(id: string, name: string | null): Promise<User> {
    const user = await this.findById(id);
    user.name = name || user.name;

    return await this.userRepo.save(user);
  }

  async updateUserPassword(
    id: string,
    password: string,
    changePassword: string,
  ): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw UserException.userNotFound();
    }

    const isExisted = await isExistedPassword(password);
    if (!isExisted) {
      throw UserException.userInfoNotExist();
    }

    const result = await isHashingPassword(changePassword);
    user.password = result;

    return await this.userRepo.save(user);
  }

  async createUser(
    transactionManager: EntityManager,
    attrs: Partial<User>,
    hashPassword: string | null = null,
  ): Promise<User> {
    const userInfo =
      hashPassword !== null
        ? { ...attrs, password: hashPassword, email: attrs.email.toLowerCase() }
        : { ...attrs, email: attrs.email.toLowerCase() };

    const user = await transactionManager.getRepository(User).save(userInfo);

    return user;
  }
}
