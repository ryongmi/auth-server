import { Module } from '@nestjs/common';

import { UserModule } from '../modules/user/user.module.js';
import { AuthModule } from '../modules/auth/auth.module.js';

import { SeederService } from './seeder.service.js';

@Module({
  imports: [UserModule, AuthModule],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
