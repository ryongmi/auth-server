import { PickType } from '@nestjs/swagger';
import { User } from '../entities';

export class LoginResponseUserDto extends PickType(User, [
  'email',
  'name',
  'nickname',
  'profileImage',
  'isEmailVerified',
] as const) {}
