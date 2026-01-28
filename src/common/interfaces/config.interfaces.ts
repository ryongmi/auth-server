import type { StringValue } from 'ms';

export interface DefaultConfig {
  mode: 'local' | 'development' | 'production';
  port: number;
  tcpPort: number;
  corsOrigins: string;
  authServerUrl: string;
  authClientUrl: string;
  portalClientUrl: string;
  allowedRedirectDomains: string;
  allowedRedirectProtocols: string;
}

export interface ClientConfig {
  authzServiceHost: string;
  authzServicePort: number;
  portalServiceHost: string;
  portalServicePort: number;
  mypickServiceHost: string;
  mypickServicePort: number;
}

export interface MysqlConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  synchronize: boolean;
  logging: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  keyPrefix: string | undefined;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

export interface NaverConfig {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

export interface JwtConfig {
  accessPrivateKey: string;
  accessPublicKey: string;
  refreshPrivateKey: string;
  refreshPublicKey: string;
  accessExpiresIn: StringValue;
  refreshExpiresIn: StringValue;
  sessionCookiePath: string;
  refreshMaxAge: number;
  cookieDomain: string;
}

export interface EncryptionConfig {
  key: string;
  salt: string;
}
