import { PickType } from '@nestjs/swagger';
import { OAuthAccount } from '../entities/oauth-account.entity';

export class OAuthAccountDto extends PickType(OAuthAccount, [
  'id',
  'provider',
  'providerId',
  'createdAt',
] as const) {}
