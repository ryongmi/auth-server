import { Expose, Type } from 'class-transformer';
import { LoginResponseUserDto } from './login-response-user.dto';
import { IsValidAccessToken } from 'src/common/decorators';

export class LoginResponseDto {
  @IsValidAccessToken(true)
  @Expose()
  accessToken?: string;

  @Expose()
  @Type(() => LoginResponseUserDto)
  user: LoginResponseUserDto;
}
