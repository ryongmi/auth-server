import { registerAs } from '@nestjs/config';

import type { EncryptionConfig } from '@common/interfaces/index.js';

export const encryptionConfig = registerAs(
  'encryption',
  (): EncryptionConfig => ({
    key: process.env.ENCRYPTION_KEY!,
    salt: process.env.ENCRYPTION_SALT || 'krgeobuk-auth-server',
  })
);
