import { type MigrationInterface, type QueryRunner } from 'typeorm';

import { USER_CONSTANTS } from '@krgeobuk/core/constants';
import { OAuthAccountProviderType } from '@krgeobuk/shared/oauth';

const { SUPER_ADMIN } = USER_CONSTANTS;

// oauth_account UUID (로컬 정의 - 공통패키지 미포함)
const SUPER_ADMIN_OAUTH_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440011';

export class SeedAdminOauthAccount20260316300003 implements MigrationInterface {
  name = 'SeedAdminOauthAccount20260316300003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO \`oauth_account\` (\`id\`, \`provider_id\`, \`provider\`, \`user_id\`)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE \`provider_id\` = \`provider_id\`
      `,
      [SUPER_ADMIN_OAUTH_ACCOUNT_ID, SUPER_ADMIN.email, OAuthAccountProviderType.HOMEPAGE, SUPER_ADMIN.id]
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`oauth_account\` WHERE \`id\` = ?`,
      [SUPER_ADMIN_OAUTH_ACCOUNT_ID]
    );
  }
}
