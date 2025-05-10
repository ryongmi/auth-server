import { Expose } from 'class-transformer';
import {
  IsValidEmail,
  IsValidNickname,
  IsValidProfileImage,
  IsValidUsername,
} from 'src/common/decorators';

// export class LoginResponseUserDto extends PickType(User, [
//   'email',
//   'name',
//   'nickname',
//   'profileImage',
//   'isEmailVerified',
// ] as const) {}

export class LoginResponseUserDto {
  @IsValidEmail()
  @Expose()
  email: string;

  @IsValidUsername()
  @Expose()
  name: string;

  @IsValidNickname(true)
  @Expose()
  nickname?: string;

  @IsValidProfileImage(true)
  @Expose()
  profileImage?: string;

  // @Expose()
  // isEmailVerified: IsEmailVerifiedDto;
}
