import { IsString } from "class-validator";

export class jwtPayload {
  @IsString()
  id?: string;
}
