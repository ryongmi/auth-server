import {
  scrypt as _scrypt,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from 'crypto';
import { promisify } from 'util';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EncryptionConfig } from '@common/interfaces/index.js';

const scrypt = promisify(_scrypt);

/**
 * 암호화 서비스
 * - 비밀번호 해싱 (단방향, scrypt)
 * - 토큰 암호화/복호화 (양방향, AES-256-CBC)
 */
@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const encryptionConfig = this.configService.get<EncryptionConfig>('encryption')!;
    this.encryptionKey = scryptSync(encryptionConfig.key, encryptionConfig.salt, 32);
  }

  // ==================== 단방향 해싱 ====================

  /**
   * 단방향 해싱 (scrypt)
   * @param plainText - 해싱할 평문
   * @returns salt;hash 형식의 해시값
   */
  async hash(plainText: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = (await scrypt(plainText, salt, 32)) as Buffer;
    return salt + ';' + hash.toString('hex');
  }

  /**
   * 해시값 검증
   * @param plainText - 검증할 평문
   * @param hashedValue - 저장된 해시값 (salt;hash)
   * @returns 일치 여부
   */
  async verify(plainText: string, hashedValue: string): Promise<boolean> {
    const parts = hashedValue.split(';');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return false;
    }
    const [salt, storedHash] = parts;
    const derivedHash = (await scrypt(plainText, salt, 32)) as Buffer;
    return storedHash === derivedHash.toString('hex');
  }

  // ==================== 토큰 암호화 (양방향) ====================

  /**
   * 문자열 암호화 (AES-256-CBC)
   * @param text - 암호화할 평문
   * @returns iv:encrypted 형식의 암호화된 문자열
   */
  encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * 암호화된 문자열 복호화
   * @param hash - iv:encrypted 형식의 암호화된 문자열
   * @returns 복호화된 평문
   */
  decrypt(hash: string): string {
    const parts = hash.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Invalid encrypted format');
    }
    const [ivHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
