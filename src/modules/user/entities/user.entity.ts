import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntityUUID } from '../../../common/entities';
import { OAuthAccount } from './oauth-account.entity';

@Entity()
export class User extends BaseEntityUUID {
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string; // 이메일은 무조건 한번만 가입가능하게

  @Column({ type: 'varchar', length: 255, nullable: true })
  password?: string; // 일반 회원가입자는 비밀번호 저장, OAuth 로그인자는 null

  @Column({
    type: 'varchar',
    length: 30,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  nickname?: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  profileImage?: string;

  @Column({ default: false })
  isEmailVerified: boolean; // 이메일 인증 여부

  @OneToOne(() => OAuthAccount, (oauthAccount) => oauthAccount.user, {
    cascade: true,
    nullable: true,
  })
  @JoinColumn()
  oauthAccount: OAuthAccount;
}
