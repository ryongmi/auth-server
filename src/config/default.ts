import { DefaultConfig } from '@common/interfaces/index.js';

export default (): DefaultConfig => {
  const mode = process.env.NODE_ENV;

  if (mode !== 'local' && mode !== 'development' && mode !== 'production') {
    return {
      mode: undefined,
      port: parseInt(process.env.PORT ?? '8000', 10),
      corsOrigins: process.env.CORS_ORIGINS,
      oauthRedirectSessionStore: process.env.OAUTH_REDIRECT_SESSION_STORE_NAME,
      portalClientUrl: process.env.PORTAL_CLIENT_URL,
    };
  }

  return {
    mode,
    port: parseInt(process.env.PORT ?? '8000', 10),
    corsOrigins: process.env.CORS_ORIGINS,
    oauthRedirectSessionStore: process.env.OAUTH_REDIRECT_SESSION_STORE_NAME,
    portalClientUrl: process.env.PORTAL_CLIENT_URL,
  };
};

