import { Module } from '@nestjs/common';
import { SeederService } from './seeder.service';
import { UserModule } from '../modules/user/user.module';
import { AuthModule } from '../modules/auth/auth.module';

@Module({
  imports: [UserModule, AuthModule],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
