import { Expose, Type } from 'class-transformer';
import { LoginResponseUserDto } from './login-response-user.dto';

export class LoginResponseDto {
  @Expose()
  accessToken: string;

  @Expose()
  @Type(() => LoginResponseUserDto)
  user: LoginResponseUserDto;
}
