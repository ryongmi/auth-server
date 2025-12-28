import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: '서비스 헬스체크' })
  @ApiResponse({ status: 200, description: '서비스가 정상 동작 중입니다.' })
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: '서비스 준비 상태 확인' })
  @ApiResponse({ status: 200, description: '서비스가 요청을 처리할 준비가 되었습니다.' })
  ready(): { status: string; timestamp: string } {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }
}
