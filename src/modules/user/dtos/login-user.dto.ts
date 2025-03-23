import { PickType } from '@nestjs/swagger';
import { User } from '../entities';

export class LoginUserDto extends PickType(User, [
  'email',
  'password',
] as const) {}
