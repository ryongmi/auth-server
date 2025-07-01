import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('service_visible_role')
@Index('IDX_SVR_SERVICE', ['serviceId']) // ✅ 서비스 기준 인덱스
@Index('IDX_SVR_ROLE', ['roleId']) // ✅ 역할 기준 인덱스
export class ServiceVisibleRoleEntity {
  @PrimaryColumn({ type: 'uuid' })
  serviceId!: string;

  @PrimaryColumn({ type: 'uuid' })
  roleId!: string;
}
