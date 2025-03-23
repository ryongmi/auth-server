import { PickType } from '@nestjs/swagger';
import { User } from '../entities';
import { OAuthAccountDto } from './oauth-account.dto';

export class UserDto extends PickType(User, [
  'id',
  'email',
  'password',
  'name',
  'nickname',
  'profileImage',
  'isEmailVerified',
] as const) {
  oauthAccount: OAuthAccountDto;
}
