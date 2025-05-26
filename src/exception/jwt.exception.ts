import {
  // BadRequestException,
  // ForbiddenException,
  HttpException,
  // HttpStatus,
  // InternalServerErrorException,
  // NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

export class JwtException {
  static refreshTokenNotFound(): HttpException {
    return new UnauthorizedException("No refresh token provided");
  }
}
