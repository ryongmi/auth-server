import { UserPayload } from "./"; // 토큰 payload 타입

declare module "express" {
  export interface Request {
    user?: UserPayload; // 여기에 원하는 타입 지정
  }
}
