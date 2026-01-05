import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Request } from 'express';

import type { DefaultConfig } from '@common/interfaces/index.js';

/**
 * 리다이렉트 URI 검증 서비스
 * OAuth 및 인증 흐름에서 리다이렉트 URI의 보안 검증을 담당
 */
@Injectable()
export class RedirectValidationService {
  private readonly logger = new Logger(RedirectValidationService.name);
  private readonly allowedDomains: string[];
  private readonly allowedProtocols: string[];
  private readonly defaultRedirectUrl: string;

  constructor(private readonly configService: ConfigService) {
    // 초기화 시 한 번만 환경변수 파싱 (성능 개선)
    this.allowedDomains = this.parseAllowedDomains();
    this.allowedProtocols = this.parseAllowedProtocols();
    this.defaultRedirectUrl =
      this.configService.get<DefaultConfig['portalClientUrl']>('portalClientUrl')!;
  }

  /**
   * 리다이렉트 URI 검증
   * @param redirectUri 검증할 리다이렉트 URI
   * @param req Express Request 객체 (보안 로깅용)
   * @returns 검증 통과 여부
   */
  async validateRedirectUri(redirectUri: string, req?: Request): Promise<boolean> {
    const url = this.parseUrl(redirectUri, req);
    if (!url) return false;

    if (!this.isProtocolAllowed(url)) {
      this.logSecurityAlert('Invalid protocol', redirectUri, req);
      return false;
    }

    if (!this.isDomainAllowed(url)) {
      this.logSecurityAlert('Unauthorized domain', redirectUri, req);
      return false;
    }

    return true;
  }

  /**
   * 기본 리다이렉트 URL 반환
   * @returns 기본 리다이렉트 URL (portalClientUrl)
   */
  getDefaultRedirectUrl(): string {
    return this.defaultRedirectUrl;
  }

  /**
   * URL 파싱 및 유효성 검사
   */
  private parseUrl(redirectUri: string, req?: Request): URL | null {
    try {
      return new URL(redirectUri);
    } catch (error) {
      this.logSecurityAlert('Invalid URL format', redirectUri, req, error);
      return null;
    }
  }

  /**
   * 프로토콜 허용 여부 확인
   */
  private isProtocolAllowed(url: URL): boolean {
    const protocol = url.protocol.slice(0, -1); // 'https:' → 'https'
    return this.allowedProtocols.includes(protocol);
  }

  /**
   * 도메인 허용 여부 확인
   */
  private isDomainAllowed(url: URL): boolean {
    const hostWithPort = url.port ? `${url.hostname}:${url.port}` : url.hostname;

    return this.allowedDomains.some((allowedDomain) =>
      this.matchesDomain(url, allowedDomain, hostWithPort)
    );
  }

  /**
   * 도메인 매칭 검증
   * 1. 정확한 매치 (포트 포함/제외)
   * 2. 서브도메인 매치 (*.krgeobuk.com)
   */
  private matchesDomain(url: URL, allowedDomain: string, hostWithPort: string): boolean {
    // 1. 정확한 매치 (포트 포함) - 개발환경용 (localhost:3000)
    if (hostWithPort === allowedDomain) return true;

    // 2. 정확한 매치 (메인 도메인만) - krgeobuk.com 허용
    if (url.hostname === allowedDomain) return true;

    // 3. 서브도메인 매치 (*.krgeobuk.com) - auth.krgeobuk.com, api.krgeobuk.com 등
    return this.isValidSubdomain(url.hostname, allowedDomain);
  }

  /**
   * 유효한 서브도메인인지 검증
   * 보안: krgeobuk.com.evil.com 같은 공격 차단
   */
  private isValidSubdomain(hostname: string, allowedDomain: string): boolean {
    if (!hostname.endsWith(`.${allowedDomain}`)) {
      return false;
    }

    const hostParts = hostname.split('.');
    const domainParts = allowedDomain.split('.');

    // 정확히 한 단계 서브도메인만 허용 (auth.krgeobuk.com ✅, sub.auth.krgeobuk.com ❌)
    if (hostParts.length !== domainParts.length + 1) {
      return false;
    }

    // 호스트의 마지막 부분이 허용된 도메인과 정확히 일치하는지 확인
    const hostSuffix = hostParts.slice(-domainParts.length).join('.');
    return hostSuffix === allowedDomain;
  }

  /**
   * 보안 경고 로깅
   */
  private logSecurityAlert(
    reason: string,
    redirectUri: string,
    req?: Request,
    error?: unknown
  ): void {
    const securityContext = {
      reason,
      requestedUri: redirectUri,
      clientIp: req?.ip || 'unknown',
      userAgent: req?.get('User-Agent') || 'unknown',
      referer: req?.get('Referer') || 'none',
      error: error instanceof Error ? error.message : undefined,
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`[SECURITY_ALERT] ${reason}`, securityContext);
  }

  /**
   * 허용된 도메인 목록 파싱
   */
  private parseAllowedDomains(): string[] {
    const domainsConfig =
      this.configService.get<DefaultConfig['allowedRedirectDomains']>('allowedRedirectDomains');

    if (!domainsConfig) {
      // 기본값 (개발환경용)
      return ['localhost:3000', 'localhost:3200', 'localhost:3210', '127.0.0.1:3000'];
    }

    return domainsConfig.split(',').map((domain: string) => domain.trim());
  }

  /**
   * 허용된 프로토콜 목록 파싱
   */
  private parseAllowedProtocols(): string[] {
    const protocolsConfig = this.configService.get<DefaultConfig['allowedRedirectProtocols']>(
      'allowedRedirectProtocols'
    );

    if (!protocolsConfig) {
      // 기본값 (개발환경용)
      return ['http', 'https'];
    }

    return protocolsConfig.split(',').map((protocol: string) => protocol.trim());
  }
}
