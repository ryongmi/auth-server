import { Module } from '@nestjs/common';

import { ImageProxyController } from './image-proxy.controller.js';
import { ImageProxyService } from './image-proxy.service.js';

/**
 * 이미지 프록시 모듈
 * 외부 OAuth 프로바이더의 프로필 이미지를 프록시하여 제공
 */
@Module({
  controllers: [ImageProxyController],
  providers: [ImageProxyService],
  exports: [ImageProxyService],
})
export class ImageModule {}
