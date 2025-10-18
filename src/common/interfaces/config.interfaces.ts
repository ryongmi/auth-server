import type { StringValue } from 'ms';

export interface DefaultConfig {
  mode: 'local' | 'development' | 'production' | undefined;
  port: number | undefined;
  tcpPort: number | undefined;
  corsOrigins: string | undefined;
  oauthRedirectSessionStore: string | undefined;
  authClientUrl: string | undefined;
  portalClientUrl: string | undefined;
  allowedRedirectDomains: string | undefined;
  allowedRedirectProtocols: string | undefined;
}

export interface ClientConfig {
  authzServiceHost: string | undefined;
  authzServicePort: number | undefined;
  portalServiceHost: string | undefined;
  portalServicePort: number | undefined;
}

export interface MysqlConfig {
  host: string | undefined;
  port: number | undefined;
  username: string | undefined;
  password: string | undefined;
  name: string | undefined;
  synchronize: boolean;
  logging: boolean;
}

export interface RedisConfig {
  host: string | undefined;
  port: number | undefined;
  password: string | undefined;
}

export interface GoogleConfig {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUrl: string | undefined;
  tokenUrl: string | undefined;
  userInfoUrl: string | undefined;
}

export interface NaverConfig {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUrl: string | undefined;
  tokenUrl: string | undefined;
  userInfoUrl: string | undefined;
}

export interface JwtConfig {
  accessPrivateKey: string | undefined;
  accessPublicKey: string | undefined;
  refreshPrivateKey: string | undefined;
  refreshPublicKey: string | undefined;
  accessExpiresIn: StringValue | undefined;
  refreshExpiresIn: StringValue | undefined;
  sessionCookiePath: string | undefined;
  refreshMaxAge: number | undefined;
  cookieDomain: string | undefined;
  refreshStore: string | undefined;
  blackListStore: string | undefined;
  naverStateStore: string | undefined;
  googleStateStore: string | undefined;
}
