import { Entity, Column, Index } from 'typeorm';

import { BaseEntityUUID } from '@krgeobuk/core/entities';

@Entity()
@Index(['serviceId', 'roleId'], { unique: true })
export class ServiceVisibleRole extends BaseEntityUUID {
  @Column({ type: 'uuid' })
  serviceId!: string;

  @Column({ type: 'uuid' })
  roleId!: string;
}
