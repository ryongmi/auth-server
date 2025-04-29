import { PickType } from '@nestjs/swagger';
import { User } from '../entities';

export class UserLoginDto extends PickType(User, [
  'email',
  'password',
] as const) {}
