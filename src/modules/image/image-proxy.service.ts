import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * 이미지 프록시 서비스
 * 외부 OAuth 프로바이더의 프로필 이미지를 프록시하여 제공
 */
@Injectable()
export class ImageProxyService {
  private readonly logger = new Logger(ImageProxyService.name);

  // 허용된 이미지 도메인 화이트리스트
  private readonly ALLOWED_DOMAINS = [
    'lh3.googleusercontent.com', // Google OAuth
    'phinf.pstatic.net', // Naver OAuth
    'ssl.pstatic.net', // Naver OAuth
    'k.kakaocdn.net', // Kakao OAuth (향후 대비)
  ];

  /**
   * 외부 이미지 URL 다운로드 및 반환
   * @param url 외부 이미지 URL
   * @returns 이미지 바이너리 데이터와 Content-Type
   */
  async fetchImage(url: string): Promise<{ data: Buffer; contentType: string }> {
    // URL 유효성 검증
    this.validateUrl(url);

    try {
      this.logger.debug(`이미지 프록시 요청: ${url}`);

      // 외부 이미지 다운로드
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000, // 10초 타임아웃
        maxRedirects: 5,
        headers: {
          'User-Agent': 'KRGeobuk-Auth-Server/1.0',
        },
      });

      // Content-Type 검증 (이미지 타입만 허용)
      const contentType = response.headers['content-type'] || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        this.logger.warn(`잘못된 Content-Type: ${contentType}`);
        throw new Error('이미지가 아닌 파일입니다.');
      }

      this.logger.debug(`이미지 다운로드 성공: ${url} (${contentType})`);

      return {
        data: Buffer.from(response.data),
        contentType,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`이미지 다운로드 실패: ${url}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error('이미지를 가져올 수 없습니다.');
    }
  }

  /**
   * URL 유효성 검증
   * - HTTPS 프로토콜만 허용
   * - 허용된 도메인만 허용 (화이트리스트)
   * - SSRF 공격 방지
   */
  private validateUrl(url: string): void {
    // URL 파싱
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (_error) {
      this.logger.warn(`잘못된 URL 형식: ${url}`);
      throw new Error('잘못된 URL 형식입니다.');
    }

    // HTTPS만 허용
    if (parsedUrl.protocol !== 'https:') {
      this.logger.warn(`HTTPS가 아닌 URL 차단: ${url}`);
      throw new Error('HTTPS URL만 허용됩니다.');
    }

    // 화이트리스트 도메인 검증
    const hostname = parsedUrl.hostname;
    const isAllowed = this.ALLOWED_DOMAINS.some((domain) => hostname === domain);

    if (!isAllowed) {
      this.logger.warn(`허용되지 않은 도메인: ${hostname}`);
      throw new Error('허용되지 않은 도메인입니다.');
    }

    // SSRF 방지: 내부 IP 주소 차단
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      const isPrivate =
        parts[0] === 10 || // 10.0.0.0/8
        (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) || // 172.16.0.0/12
        (parts[0] === 192 && (parts[1] ?? 0) === 168) || // 192.168.0.0/16
        parts[0] === 127; // 127.0.0.0/8 (localhost)

      if (isPrivate) {
        this.logger.warn(`내부 IP 주소 차단: ${hostname}`);
        throw new Error('내부 IP 주소는 허용되지 않습니다.');
      }
    }
  }
}
