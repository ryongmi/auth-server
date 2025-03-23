import { PickType } from '@nestjs/swagger';
import { User } from '../entities';

export class UserDto extends PickType(User, [
  'id',
  'type',
  'email',
  'password',
  'name',
  'nickname',
  'profileImage',
] as const) {}
