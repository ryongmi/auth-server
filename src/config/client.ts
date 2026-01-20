import { registerAs } from '@nestjs/config';

import { ClientConfig } from '@/common/interfaces/config.interfaces.js';

export const clientConfig = registerAs(
  'client',
  (): ClientConfig => ({
    authzServiceHost: process.env.AUTHZ_SERVICE_HOST,
    authzServicePort: parseInt(process.env.AUTHZ_SERVICE_PORT ?? '8110', 10),
    portalServiceHost: process.env.PORTAL_SERVICE_HOST,
    portalServicePort: parseInt(process.env.PORTAL_SERVICE_PORT ?? '8210', 10),
    mypickServiceHost: process.env.MYPICK_SERVICE_HOST,
    mypickServicePort: parseInt(process.env.MYPICK_SERVICE_PORT ?? '8310', 10),
  })
);
