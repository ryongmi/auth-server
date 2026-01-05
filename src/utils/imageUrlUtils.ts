/**
 * 이미지 URL 유틸리티
 * 외부 OAuth 프로바이더의 프로필 이미지 URL을 auth-server의 프록시 URL로 변환
 */

/**
 * 외부 이미지 URL을 프록시 URL로 변환
 *
 * @param externalUrl 외부 이미지 URL (예: https://lh3.googleusercontent.com/...)
 * @returns 프록시 URL (예: http://localhost:8000/api/proxy/image?url=...)
 *
 * @example
 * // 개발 환경
 * convertToProxyUrl('https://lh3.googleusercontent.com/a/example')
 * // => 'http://localhost:8000/api/proxy/image?url=https%3A%2F%2Flh3.googleusercontent.com%2Fa%2Fexample'
 *
 * @example
 * // null/undefined 처리
 * convertToProxyUrl(null) // => null
 * convertToProxyUrl(undefined) // => null
 *
 * @example
 * // 이미 프록시 URL인 경우
 * convertToProxyUrl('http://localhost:8000/api/proxy/image?url=...')
 * // => 'http://localhost:8000/api/proxy/image?url=...' (그대로 반환)
 */
export function convertToProxyUrl(externalUrl: string | null | undefined): string | null {
  // null/undefined 처리
  if (!externalUrl) {
    return null;
  }

  // 환경변수에서 auth-server URL 가져오기
  const authServerUrl = process.env.AUTH_SERVER_URL || 'http://localhost:8000/auth';

  // 이미 프록시 URL인 경우 그대로 반환
  if (externalUrl.startsWith(authServerUrl)) {
    return externalUrl;
  }

  // 외부 URL을 프록시 URL로 변환
  const encodedUrl = encodeURIComponent(externalUrl);
  return `${authServerUrl}/proxy/image?url=${encodedUrl}`;
}
