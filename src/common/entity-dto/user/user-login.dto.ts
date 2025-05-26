import { IsValidEmail, IsValidPassword } from "src/common/decorators";

export class UserLoginDto {
  @IsValidEmail()
  email: string;

  @IsValidPassword()
  password: string;
}
