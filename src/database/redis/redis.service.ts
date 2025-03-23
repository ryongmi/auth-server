import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis, // Redis 클라이언트 주입
  ) {}

  // state 값 저장, 5분 동안 만료
  async setExValue(state: string, value: string): Promise<void> {
    // value를 Redis에 저장하고, 5분(300초) 후에 만료되도록 설정
    await this.redisClient.setex(state, 300, value); // setex: key, expire(초), value
  }

  async setValue(key: string, value: string): Promise<void> {
    await this.redisClient.set(key, value);
  }

  async getValue(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async deleteValue(key: string): Promise<void> {
    await this.redisClient.del(key);
  }
}
