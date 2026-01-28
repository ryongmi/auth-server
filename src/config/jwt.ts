import * as fs from 'fs';

import { registerAs } from '@nestjs/config';

import type { StringValue } from 'ms';

import { JwtConfig } from '@/common/interfaces/config.interfaces.js';

export const jwtConfig = registerAs(
  'jwt',
  (): JwtConfig => ({
    accessPrivateKey: fs.readFileSync(process.env.JWT_ACCESS_PRIVATE_KEY_PATH!, 'utf-8'),
    accessPublicKey: fs.readFileSync(process.env.JWT_ACCESS_PUBLIC_KEY_PATH!, 'utf-8'),
    refreshPrivateKey: fs.readFileSync(process.env.JWT_REFRESH_PRIVATE_KEY_PATH!, 'utf-8'),
    refreshPublicKey: fs.readFileSync(process.env.JWT_REFRESH_PUBLIC_KEY_PATH!, 'utf-8'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN as StringValue,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN as StringValue,
    sessionCookiePath: process.env.JWT_SESSION_COOKIE_PATH!,
    refreshMaxAge: parseInt(process.env.JWT_REFRESH_MAX_AGE ?? '0', 10),
    cookieDomain: process.env.JWT_COOKIE_DOMAIN!,
  })
);
