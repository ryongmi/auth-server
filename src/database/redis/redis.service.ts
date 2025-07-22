import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

import { REDIS_CLIENT_TOKEN } from '@krgeobuk/database-config';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';

import { DefaultConfig, JwtConfig } from '@common/interfaces/index.js';

@Injectable()
export class RedisService {
  constructor(
    @Inject(REDIS_CLIENT_TOKEN) private readonly redisClient: Redis,
    private readonly configService: ConfigService
  ) {}

  // state 값 저장, 5분 동안 만료
  async setExValue(state: string, expire: number, value: string | number | Buffer): Promise<void> {
    // value를 Redis에 저장하고, 5분(300초) 후에 만료되도록 설정
    await this.redisClient.setex(state, expire, value); // setex: key, expire(초), value
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

  // SSO 세션 관리 메서드
  async setRedirectSession(
    sessionId: string,
    redirectUri: string,
    ttl: number = 300
  ): Promise<void> {
    const sessionData = {
      redirectUri,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
    const oauthRedirectSessionStore =
      this.configService.get<DefaultConfig['oauthRedirectSessionStore']>(
        `oauthRedirectSessionStore`
      )!;

    await this.setExValue(
      `${oauthRedirectSessionStore}${sessionId}`,
      ttl,
      JSON.stringify(sessionData)
    );
  }

  async getRedirectSession(
    sessionId: string
  ): Promise<{ redirectUri: string; createdAt: string; expiresAt: string } | null> {
    const oauthRedirectSessionStore =
      this.configService.get<DefaultConfig['oauthRedirectSessionStore']>(
        `oauthRedirectSessionStore`
      )!;
    const sessionData = await this.getValue(`${oauthRedirectSessionStore}${sessionId}`);

    return sessionData ? JSON.parse(sessionData) : null;
  }

  async deleteRedirectSession(sessionId: string): Promise<void> {
    const oauthRedirectSessionStore =
      this.configService.get<DefaultConfig['oauthRedirectSessionStore']>(
        `oauthRedirectSessionStore`
      )!;

    await this.deleteValue(`${oauthRedirectSessionStore}${sessionId}`);
  }

  async setOAuthState(
    type: OAuthAccountProviderType,
    state: string,
    redirectSession?: string,
    ttl: number = 300
  ): Promise<void> {
    const stateStore = this.configService.get<JwtConfig['naverStateStore' | 'googleStateStore']>(
      `jwt.${type}StateStore`
    )!;
    const stateValue = redirectSession || 'pending';

    await this.setExValue(`${stateStore}${state}`, ttl, stateValue);
  }

  async getOAuthState(type: OAuthAccountProviderType, state: string): Promise<string | null> {
    const stateStore = this.configService.get<JwtConfig['naverStateStore' | 'googleStateStore']>(
      `jwt.${type}StateStore`
    )!;

    return await this.getValue(`${stateStore}${state}`);
  }

  async deleteOAuthState(type: OAuthAccountProviderType, state: string): Promise<void> {
    const stateStore = this.configService.get<JwtConfig[`naverStateStore` | 'googleStateStore']>(
      `jwt.${type}StateStore`
    )!;

    await this.deleteValue(`${stateStore}${state}`);
  }
}
