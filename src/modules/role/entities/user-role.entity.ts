import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('user_role')
@Index('IDX_USER_ROLE_USER', ['userId']) // ✅ 사용자 기준 인덱스
@Index('IDX_USER_ROLE_ROLE', ['roleId']) // ✅ 역할 기준 인덱스
export class UserRoleEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ type: 'uuid' })
  roleId!: string;
}
