import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

import { type MigrationInterface, type QueryRunner } from 'typeorm';

import { USER_CONSTANTS } from '@krgeobuk/core/constants';

const scryptAsync = promisify(scrypt);

const { SUPER_ADMIN } = USER_CONSTANTS;

// oauth_account UUID (로컬 정의 - 공통패키지 미포함)
const SUPER_ADMIN_OAUTH_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440011';

/**
 * CryptoService.hash()와 동일한 방식으로 비밀번호 해싱
 * 형식: salt;hash (scrypt, 32바이트)
 */
async function hashPassword(plainText: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(plainText, salt, 32)) as Buffer;
  return salt + ';' + hash.toString('hex');
}

export class SeedAdminUser20260314300002 implements MigrationInterface {
  name = 'SeedAdminUser20260314300002';

  async up(queryRunner: QueryRunner): Promise<void> {
    const plainPassword = process.env.ADMIN_INITIAL_PASSWORD ?? '2316@@qwer';
    const hashedPassword = await hashPassword(plainPassword);

    await queryRunner.query(
      `
      INSERT INTO \`user\` (\`id\`, \`email\`, \`password\`, \`name\`, \`is_email_verified\`)
      VALUES (?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE \`email\` = \`email\`
      `,
      [SUPER_ADMIN.id, SUPER_ADMIN.email, hashedPassword, SUPER_ADMIN.name]
    );

    await queryRunner.query(
      `
      INSERT INTO \`oauth_account\` (\`id\`, \`provider_id\`, \`provider\`, \`user_id\`)
      VALUES (?, ?, 'homepage', ?)
      ON DUPLICATE KEY UPDATE \`provider_id\` = \`provider_id\`
      `,
      [SUPER_ADMIN_OAUTH_ACCOUNT_ID, SUPER_ADMIN.email, SUPER_ADMIN.id]
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`oauth_account\` WHERE \`id\` = ?`,
      [SUPER_ADMIN_OAUTH_ACCOUNT_ID]
    );
    await queryRunner.query(
      `DELETE FROM \`user\` WHERE \`id\` = ?`,
      [SUPER_ADMIN.id]
    );
  }
}
