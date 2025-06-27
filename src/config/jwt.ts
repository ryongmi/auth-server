import { registerAs } from '@nestjs/config';

import * as fs from 'fs';

export const jwtConfig = registerAs('jwt', () => ({
  accessPrivateKey: fs.readFileSync(process.env.JWT_ACCESS_PRIVATE_KEY_PATH!, 'utf-8'),
  accessPublicKey: fs.readFileSync(process.env.JWT_ACCESS_PUBLIC_KEY_PATH!, 'utf-8'),
  refreshPrivateKey: fs.readFileSync(process.env.JWT_REFRESH_PRIVATE_KEY_PATH!, 'utf-8'),
  refreshPublicKey: fs.readFileSync(process.env.JWT_REFRESH_PUBLIC_KEY_PATH!, 'utf-8'),
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  sessionCookiePath: process.env.JWT_SESSION_COOKIE_PATH,
  refreshMaxAge: process.env.JWT_REFRESH_MAX_AGE,
  refreshStore: process.env.JWT_REFRESH_STORE_NAME,
  blackListStore: process.env.JWT_BLACKLIST_STORE_NAME,
  naverStateStore: process.env.JWT_NAVER_STATE_STORE_NAME,
  googleStateStore: process.env.JWT_GOOGLE_STATE_STORE_NAME,
}));
