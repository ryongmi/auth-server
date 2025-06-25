import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

@Entity('user_role')
@Index(['userId, roleId'], { unique: true }) // 중복 권한 부여 방지
export class UserRole extends BaseEntityUUID {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  roleId!: string;
}
