import { DefaultConfig } from '@common/interfaces/index.js';

export default (): DefaultConfig => {
  const mode = process.env.NODE_ENV;

  if (mode !== 'local' && mode !== 'development' && mode !== 'production') {
    return {
      mode: undefined,
      port: parseInt(process.env.PORT ?? '8000', 10),
      tcpPort: parseInt(process.env.TCP_PORT ?? '8010', 10),
      corsOrigins: process.env.CORS_ORIGINS,
      oauthRedirectSessionStore: process.env.OAUTH_REDIRECT_SESSION_STORE_NAME,
      authClientUrl: process.env.AUTH_CLIENT_URL,
      allowedRedirectDomains: process.env.ALLOWED_REDIRECT_DOMAINS,
      allowedRedirectProtocols: process.env.ALLOWED_REDIRECT_PROTOCOLS,
    };
  }

  return {
    mode,
    port: parseInt(process.env.PORT ?? '8000', 10),
    tcpPort: parseInt(process.env.TCP_PORT ?? '8010', 10),
    corsOrigins: process.env.CORS_ORIGINS,
    oauthRedirectSessionStore: process.env.OAUTH_REDIRECT_SESSION_STORE_NAME,
    authClientUrl: process.env.AUTH_CLIENT_URL,
    allowedRedirectDomains: process.env.ALLOWED_REDIRECT_DOMAINS,
    allowedRedirectProtocols: process.env.ALLOWED_REDIRECT_PROTOCOLS,
  };
};
