import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request, Response } from "express";
import { JwtException } from "../../../exception";
import { UserPayload } from "src/common/interface";
import { jwtPayload } from "../dtos";

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  // async signAccessTokenAndRefreshToken(payload: any) {
  //   const accessToken = await this.signAccessToken(payload);
  //   const refreshToken = await this.signRefreshToken(payload);

  //   return { accessToken, refreshToken };
  // }

  async signAccessTokenAndRefreshToken(
    payload: jwtPayload
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken(payload, "access"),
      this.signToken(payload, "refresh"),
    ]);

    return { accessToken, refreshToken };
  }

  private async signToken(payload: jwtPayload, type: "access" | "refresh"): Promise<string> {
    try {
      const secret = this.configService.get<string>(`jwt.${type}Secret`);
      const expiresIn = this.configService.get<string>(`jwt.${type}ExpiresIn`);

      if (!secret || !expiresIn) {
        throw new Error(`${type} token config is missing`);
      }

      return await this.jwtService.signAsync(payload, {
        secret,
        expiresIn,
      });
    } catch (error: unknown) {
      console.error(`JWT ${type} token 서명 실패`, error);
      throw new Error(`Invalid ${type} token`);
    }
  }

  async signAccessToken(payload: jwtPayload): Promise<string> {
    try {
      const secret = this.configService.get<string>("jwt.accessSecret");
      const expiresIn = this.configService.get<string>("jwt.accessExpiresIn");

      const token = await this.jwtService.signAsync(payload, {
        secret,
        expiresIn, // AccessToken은 짧게
      });

      return token;
    } catch (error: unknown) {
      console.error("JWT 토큰 서명 실패", error);
      throw new Error("Invalid token");
      // throw new InternalServerErrorException('에세스 토큰 생성 실패');
    }
  }

  async signRefreshToken(payload: jwtPayload): Promise<string> {
    try {
      const secret = this.configService.get<string>("jwt.refreshSecret");
      const expiresIn = this.configService.get<string>("jwt.refreshExpiresIn");
      const token = await this.jwtService.signAsync(payload, {
        secret,
        expiresIn, // RefreshToken은 길게
      });

      return token;
    } catch (error) {
      console.error("JWT 토큰 서명 실패", error);
      throw new Error("Invalid token");
      // throw new InternalServerErrorException('리프레시 토큰 생성 실패');
    }
  }

  // Access Token 복호화
  async decodeAccessToken(token: string): Promise<Partial<UserPayload>> {
    try {
      const secret = this.configService.get<string>("jwt.accessSecret");
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      return payload;
    } catch (error: unknown) {
      console.log("Access Token 복호화 실패", error);
      throw new Error("Invalid Access Token");
    }
  }

  // Refresh Token 복호화
  async decodeRefreshToken(token: string): Promise<Partial<UserPayload>> {
    try {
      const secret = this.configService.get<string>("jwt.refreshSecret");
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      return payload;
    } catch (error: unknown) {
      console.log("Refresh Token 복호화 실패", error);
      throw new Error("Invalid Refresh Token");
    }
  }

  getRefreshTokenToCookie(req: Request): string | undefined {
    const refreshTokenStore = this.configService.get<string>("jwt.refreshStore")!;
    const refreshToken = req.cookies[refreshTokenStore] as string | undefined;

    if (!refreshToken) {
      throw JwtException.refreshTokenNotFound();
    }

    return refreshToken;
  }

  setRefreshTokenToCookie(res: Response, refreshToken: string): void {
    const refreshTokenStore = this.configService.get<string>("jwt.refreshStore")!;
    const refreshMaxAge = this.configService.get<number>("jwt.refreshMaxAge")!;
    const mode = this.configService.get<string>("mode")!;
    const cookiePath = this.configService.get<string>("jwt.sessionCookiePath")!;

    res.cookie(refreshTokenStore, refreshToken, {
      // httpOnly: true,
      httpOnly: mode === "production",
      secure: mode === "production",
      sameSite: "strict",
      path: cookiePath,
      maxAge: refreshMaxAge, // 예: 7일
    });
  }

  clearRefreshTokenCookie(res: Response): void {
    const refreshTokenStore = this.configService.get<string>("jwt.refreshStore")!;
    const mode = this.configService.get<string>("mode")!;
    const cookiePath = this.configService.get<string>("jwt.sessionCookiePath")!;

    res.clearCookie(refreshTokenStore, {
      // httpOnly: true,
      httpOnly: mode === "production",
      secure: mode === "production",
      sameSite: "strict",
      path: cookiePath,
    });
  }
}
