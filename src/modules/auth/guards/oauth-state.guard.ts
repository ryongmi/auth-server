import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthException } from 'src/exception';
import { RedisService } from 'src/database/redis/redis.service';

@Injectable()
export class OAuthStateGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {} // RedisService 주입

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { state } = request.query; // 요청에서 state 값을 가져옴

    // state 값이 없으면 예외 처리
    if (!state) {
      throw AuthException.authStateNotFound();
    }

    // state 값이 유효한지 Redis에서 확인
    const isValidState = await this.redisService.getValue(state);

    if (!isValidState) {
      throw AuthException.authStateExpired();
    }

    // 유효성 검사 끝난 state 레디스에서 삭제
    await this.redisService.deleteValue(state);

    return true;
  }
}
