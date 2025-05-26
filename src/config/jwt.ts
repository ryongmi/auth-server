import { registerAs } from "@nestjs/config";

export const jwtConfig = registerAs("jwt", () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN,
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  sessionCookiePath: process.env.JWT_SESSION_COOKIE_PATH,
  refreshMaxAge: process.env.JWT_REFRESH_MAX_AGE,
  refreshStore: process.env.JWT_REFRESH_STORE_NAME,
  blackListStore: process.env.JWT_BLACKLIST_STORE_NAME,
  naverStateStore: process.env.JWT_NAVER_STATE_STORE_NAME,
}));
