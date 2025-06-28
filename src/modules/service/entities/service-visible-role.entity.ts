import { Entity, PrimaryColumn } from 'typeorm';

@Entity('service_visible_role')
export class ServiceVisibleRole {
  @PrimaryColumn({ type: 'uuid' })
  serviceId!: string;

  @PrimaryColumn({ type: 'uuid' })
  roleId!: string;
}
