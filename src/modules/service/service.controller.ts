import { Controller } from '@nestjs/common';
// import { Request, Response } from 'express';

// import { Serialize } from '@krgeobuk/core/decorators';
// import {
//   LoginRequestDto,
//   LoginResponseDto,
//   SignupRequestDto,
//   RefreshResponseDto,
// } from '@krgeobuk/auth/dtos';
// import { AuthError } from '@krgeobuk/auth/exception';
// import { AuthResponse } from '@krgeobuk/auth/response';
import {
  SwaggerApiTags,
  // SwaggerApiBody,
  // SwaggerApiOperation,
  // SwaggerApiOkResponse,
  // SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
// import { JwtPayload } from '@krgeobuk/jwt/interfaces';
// import { CurrentJwt } from '@krgeobuk/jwt/decorators';
// import { AccessTokenGuard } from '@krgeobuk/jwt/guards';

// import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { ServiceManager } from './service.manager.js';

// import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
// import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';

@SwaggerApiTags({ tags: ['authorizations'] })
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceManager: ServiceManager) {}

  // 전체 서비스 목록 조회
  // @Get()
  // async searchServices(): Promise<PaginatedResult<>> {
  //   return await this.serviceService.searchServices();
  // }

  // // 단일 서비스 조회
  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.serviceService.findOne(id);
  // }

  // // 서비스 생성
  // @Post()
  // create(@Body() dto: CreateServiceDto) {
  //   return this.serviceService.create(dto);
  // }

  // // 서비스 수정
  // @Patch(':id')
  // update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
  //   return this.serviceService.update(id, dto);
  // }

  // // 서비스 삭제
  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.serviceService.remove(id);
  // }
}
