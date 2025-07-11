import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import type { UserDetail, UserFilter } from '@krgeobuk/user/interfaces';

import { UserService } from './user.service.js';
import { UserEntity } from './entities/user.entity.js';

/**
 * User 도메인 TCP 마이크로서비스 컨트롤러
 * 다른 서비스들이 auth-server의 사용자 정보에 접근할 때 사용
 */
@Controller()
export class UserTcpController {
  private readonly logger = new Logger(UserTcpController.name);

  constructor(private readonly userService: UserService) {}

  /**
   * 사용자 ID로 사용자 정보 조회
   */
  @MessagePattern('user.findById')
  async findUserById(@Payload() data: { userId: string }): Promise<UserEntity | null> {
    this.logger.log(`TCP: Finding user by ID: ${data.userId}`);

    try {
      return await this.userService.findById(data.userId);
    } catch (error) {
      this.logger.error(`TCP: Error finding user by ID ${data.userId}:`, error);
      throw error;
    }
  }

  /**
   * 사용자 ID로 상세 정보 조회 (가공된 데이터)
   */
  @MessagePattern('user.getDetailById')
  async getUserDetailById(@Payload() data: { userId: string }): Promise<UserDetail | null> {
    this.logger.log(`TCP: Getting user detail by ID: ${data.userId}`);

    try {
      return await this.userService.getUserDetailById(data.userId);
    } catch (error) {
      this.logger.error(`TCP: Error getting user detail by ID ${data.userId}:`, error);
      throw error;
    }
  }

  /**
   * 이메일로 사용자 조회
   */
  @MessagePattern('user.findByEmail')
  async findUserByEmail(@Payload() data: { email: string }): Promise<UserEntity | null> {
    this.logger.log(`TCP: Finding user by email: ${data.email}`);

    try {
      return await this.userService.findByEmail(data.email);
    } catch (error) {
      this.logger.error(`TCP: Error finding user by email ${data.email}:`, error);
      throw error;
    }
  }

  /**
   * 여러 사용자 ID로 사용자 목록 조회
   */
  @MessagePattern('user.findByIds')
  async findUsersByIds(@Payload() data: { userIds: string[] }): Promise<UserEntity[]> {
    this.logger.log(`TCP: Finding users by IDs: ${data.userIds.join(', ')}`);

    try {
      return await this.userService.findByIds(data.userIds);
    } catch (error) {
      this.logger.error(`TCP: Error finding users by IDs:`, error);
      throw error;
    }
  }

  /**
   * 필터 조건으로 사용자 목록 조회
   */
  @MessagePattern('user.findByFilter')
  async findUsersByFilter(@Payload() data: { filter: UserFilter }): Promise<UserEntity[]> {
    this.logger.log(`TCP: Finding users by filter:`, data.filter);

    try {
      return await this.userService.findByAnd(data.filter);
    } catch (error) {
      this.logger.error(`TCP: Error finding users by filter:`, error);
      throw error;
    }
  }

  /**
   * 사용자 존재 여부 확인
   */
  @MessagePattern('user.exists')
  async checkUserExists(@Payload() data: { userId: string }): Promise<boolean> {
    this.logger.log(`TCP: Checking if user exists: ${data.userId}`);

    try {
      const user = await this.userService.findById(data.userId);
      return !!user;
    } catch (error) {
      this.logger.error(`TCP: Error checking user existence ${data.userId}:`, error);
      return false;
    }
  }

  /**
   * 사용자 통계 조회 (총 사용자 수 등)
   */
  @MessagePattern('user.getStats')
  async getUserStats(
    @Payload() _data?: unknown
  ): Promise<{ totalUsers: number; verifiedUsers: number }> {
    this.logger.log(`TCP: Getting user statistics`);

    try {
      const [totalUsers, verifiedUsers] = await Promise.all([
        this.userService.countUsers(),
        this.userService.countUsers({ isEmailVerified: true }),
      ]);

      return { totalUsers, verifiedUsers };
    } catch (error) {
      this.logger.error(`TCP: Error getting user statistics:`, error);
      throw error;
    }
  }

  /**
   * 사용자 이메일 인증 상태 확인
   */
  @MessagePattern('user.isEmailVerified')
  async isEmailVerified(@Payload() data: { userId: string }): Promise<boolean> {
    this.logger.log(`TCP: Checking email verification for user: ${data.userId}`);

    try {
      const user = await this.userService.findById(data.userId);
      return user?.isEmailVerified ?? false;
    } catch (error) {
      this.logger.error(`TCP: Error checking email verification ${data.userId}:`, error);
      return false;
    }
  }
}
