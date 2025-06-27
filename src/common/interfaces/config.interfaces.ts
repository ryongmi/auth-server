export interface DefaultConfig {
  mode: 'local' | 'development' | 'production' | undefined;
  port: number | undefined;
  corsOrigins: string | undefined;
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
  accessExpiresIn: string | undefined;
  refreshExpiresIn: string | undefined;
  sessionCookiePath: string | undefined;
  refreshMaxAge: number | undefined;
  refreshStore: string | undefined;
  blackListStore: string | undefined;
  naverStateStore: string | undefined;
  googleStateStore: string | undefined;
}
