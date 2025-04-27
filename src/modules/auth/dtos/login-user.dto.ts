import { PickType } from '@nestjs/swagger';
import { User } from '../../user/entities';

export class LoginUserDto extends PickType(User, [
  'email',
  'password',
] as const) {}
