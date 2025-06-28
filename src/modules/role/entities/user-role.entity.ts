import { Entity, PrimaryColumn } from 'typeorm';

@Entity('user_role')
export class UserRole {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ type: 'uuid' })
  roleId!: string;
}
