import { Module } from '@nestjs/common';

import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationService } from './authorization.service.js';

@Module({
  // imports: [TypeOrmModule.forFeature([Service, Role, UserRole, ServiceVisibleRole])],
  controllers: [AuthorizationController],
  providers: [AuthorizationService],
  exports: [AuthorizationService], // 다른 모듈에서 User 서비스를 사용할 수 있도록 exports에 추가
})
export class AuthorizationModule {}
