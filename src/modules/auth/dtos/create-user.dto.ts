import { PickType } from '@nestjs/swagger';
import { User } from '../../user/entities';

export class CreateUserDto extends PickType(User, [
  'email',
  'password',
  'name',
  'nickname',
  'profileImage',
] as const) {}
