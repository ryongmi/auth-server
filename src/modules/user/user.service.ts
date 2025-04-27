import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}
  // constructor(private userRepo: UserRepository) {}

  async findById(id: string): Promise<User> {
    if (!id) return null;

    return await this.repo.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<User> {
    return await this.repo.findOneBy({ email });
  }

  async findByUserId(id: string): Promise<User> {
    return await this.repo.findOneBy({ id });
  }

  async findByUserIdOREmail(id: string, email: string): Promise<User[]> {
    return await this.repo.findBy([{ id }, { email }]);
  }

  async lastLoginUpdate(id: string) {
    // return await this.repo.save(attrs);
    // await this.repo
    //   .createQueryBuilder()
    //   .update(User)
    //   .set({ lastLogin: new Date() })
    //   .where('id = :id', { id })
    //   .execute();
  }

  async updateUser(attrs: Partial<User>): Promise<User> {
    return await this.repo.save(attrs);

    // if (!attrs.id) {
    //   await transactionManager
    //     .getRepository(User_Role)
    //     .save({ user_id: user.id });
    // }
  }

  async createUser(
    transactionManager: EntityManager,
    attrs: Partial<User>,
    hashPassword: string | null = null,
  ): Promise<User> {
    const userInfo =
      hashPassword !== null
        ? { ...attrs, password: hashPassword }
        : { ...attrs };

    const user = await transactionManager.getRepository(User).save(userInfo);
    // await transactionManager.getRepository(UserRole).save({ userId: user.id });

    return user;
  }
}
