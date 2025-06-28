import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

@Entity()
@Index(['name', 'serviceId'], { unique: true }) // 같은 서비스 내 이름 중복 방지
export class Role extends BaseEntityUUID {
  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({
    type: 'tinyint',
    unsigned: true,
    default: 9,
    comment: '낮을수록 더 높은 권한 - 최상위 1',
  })
  priority?: number;

  @Column({ type: 'uuid' })
  serviceId!: string; // 외래 키지만 관계는 맺지 않음
}
