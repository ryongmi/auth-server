import { Controller, Get, Query, Res, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { Response } from 'express';

import { ImageProxyService } from './image-proxy.service.js';

/**
 * 이미지 프록시 컨트롤러
 * 외부 OAuth 프로바이더의 프로필 이미지를 프록시하여 제공
 */
@ApiTags('Image Proxy')
@Controller('proxy')
export class ImageProxyController {
  private readonly logger = new Logger(ImageProxyController.name);

  constructor(private readonly imageProxyService: ImageProxyService) {}

  /**
   * 외부 이미지 프록시 엔드포인트
   * GET /api/proxy/image?url={외부URL}
   */
  @Get('image')
  @ApiOperation({
    summary: '외부 이미지 프록시',
    description:
      'OAuth 프로바이더의 프로필 이미지를 프록시하여 제공합니다. Next.js Image 컴포넌트 최적화를 위해 사용됩니다.',
  })
  @ApiQuery({
    name: 'url',
    description: '외부 이미지 URL (HTTPS만 허용, 허용된 도메인만 가능)',
    required: true,
    example: 'https://lh3.googleusercontent.com/a/example=s96-c',
  })
  @ApiResponse({
    status: 200,
    description: '이미지 데이터 반환 성공',
    headers: {
      'Content-Type': {
        description: '이미지 MIME 타입 (예: image/jpeg, image/png)',
        schema: { type: 'string' },
      },
      'Cache-Control': {
        description: '캐시 제어 헤더',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 URL 또는 허용되지 않은 도메인' })
  @ApiResponse({ status: 500, description: '이미지 다운로드 실패' })
  async proxyImage(@Query('url') url: string, @Res() res: Response): Promise<void> {
    this.logger.log(`이미지 프록시 요청: ${url}`);

    // URL 파라미터 검증
    if (!url || typeof url !== 'string') {
      this.logger.warn('URL 파라미터 누락');
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'URL 파라미터가 필요합니다.',
      });
      return;
    }

    try {
      // 이미지 다운로드
      const { data, contentType } = await this.imageProxyService.fetchImage(url);

      // 캐시 제어 헤더 설정 (브라우저 캐싱 1일)
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable', // 1일 캐시
        'X-Content-Type-Options': 'nosniff',
      });

      // 이미지 데이터 전송
      res.status(HttpStatus.OK).send(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`이미지 프록시 실패: ${url}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: errorMessage || '이미지를 가져올 수 없습니다.',
      });
    }
  }
}
