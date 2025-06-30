import { DefaultConfig } from '@common/interfaces/index.js';

export default (): DefaultConfig => {
  const mode = process.env.NODE_ENV;

  if (mode !== 'local' && mode !== 'development' && mode !== 'production') {
    return {
      mode: undefined,
      port: parseInt(process.env.PORT ?? '8000', 10),
      corsOrigins: process.env.CORS_ORIGINS,
    };
  }

  return {
    mode,
    port: parseInt(process.env.PORT ?? '8000', 10),
    corsOrigins: process.env.CORS_ORIGINS,
  };
};
