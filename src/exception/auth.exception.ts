import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export class AuthException {
  static authStateNotFound(): HttpException {
    return new UnauthorizedException('State is missing');
  }

  // 상태가 만료되었을 경우
  static authStateExpired(): HttpException {
    return new UnauthorizedException('Invalid or expired state');
  }

  // 상태가 존재하지 않는 경우
  static authStateNotExist(): HttpException {
    return new ForbiddenException('State is invalid or expired');
  }

  // 로그인 세션이 없는 경우
  static authSessionNotFound(): HttpException {
    return new UnauthorizedException(
      'Login session not found. Please log in again.',
    );
  }

  // 로그인 중 서버에서 오류가 발생한 경우
  static authLoginError(): HttpException {
    return new InternalServerErrorException('An error occurred during login.');
  }

  // 400 BadRequest 예외 추가 예시
  static authInvalidRequest(): HttpException {
    return new BadRequestException('The request is invalid.');
  }
}
