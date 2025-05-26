import { User } from "./user.entity";
import { BaseEntityUUID } from "../../../common/entities";
import { UserType } from "../../../common/enum";
import { Entity, Column, OneToOne } from "typeorm";

@Entity("oauth_account")
export class OAuthAccount extends BaseEntityUUID {
  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  providerId!: string; // OAuth 제공자의 사용자 고유 ID

  @Column({ type: "varchar", length: 255 })
  provider!: UserType; // 'google', 'naver' 등 OAuth 제공자

  //   @ManyToOne(() => User, (user) => user.oauthAccounts, { onDelete: 'CASCADE' })
  //   user: User;
  @OneToOne(() => User, (user) => user.oauthAccount)
  user!: User;
}
