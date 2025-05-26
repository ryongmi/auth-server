import {
  IsValidEmail,
  IsValidNickname,
  IsValidPassword,
  IsValidProfileImage,
  IsValidUsername,
} from "src/common/decorators";
import { BaseDtoUUIDIsOptional } from "src/common/dtos";

// export class CreateUserDto extends PickType(User, [
//   'email',
//   'password',
//   'name',
//   'nickname',
//   'profileImage',
// ] as const) {}

export class CreateUserDto extends BaseDtoUUIDIsOptional {
  @IsValidEmail()
  email: string;

  @IsValidPassword()
  password: string;

  @IsValidUsername()
  name: string;

  @IsValidNickname(true)
  nickname?: string;

  @IsValidProfileImage(true)
  profileImage?: string;
}
