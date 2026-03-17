import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateAuthTables20260314300001 implements MigrationInterface {
  name = 'CreateAuthTables20260314300001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // user 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`user\` (
        \`id\`                VARCHAR(36)      NOT NULL,
        \`email\`             VARCHAR(255)  NOT NULL,
        \`password\`          VARCHAR(255)  NULL,
        \`name\`              VARCHAR(30)   NOT NULL,
        \`nickname\`          VARCHAR(20)   NULL,
        \`profile_image_url\` VARCHAR(2048) NULL,
        \`is_email_verified\` TINYINT(1)   NOT NULL DEFAULT 0,
        \`created_at\`        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\`        DATETIME(6)  NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_USER_EMAIL\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // oauth_account 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`oauth_account\` (
        \`id\`              VARCHAR(36)     NOT NULL,
        \`provider_id\`     VARCHAR(255) NOT NULL,
        \`provider\`        ENUM('homepage','google','naver') NOT NULL,
        \`access_token\`    TEXT         NULL,
        \`refresh_token\`   TEXT         NULL,
        \`token_expires_at\` DATETIME   NULL,
        \`scopes\`          VARCHAR(500) NULL,
        \`user_id\`         VARCHAR(36)     NOT NULL,
        \`created_at\`      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\`      DATETIME(6) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_OAUTH_ACCOUNT_ID_USER\` (\`id\`, \`user_id\`),
        UNIQUE KEY \`UQ_OAUTH_ACCOUNT_USER_PROVIDER\` (\`user_id\`, \`provider\`),
        INDEX \`IDX_OAUTH_ACCOUNT_USER_ID\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // account_merge 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`account_merge\` (
        \`id\`               BIGINT        NOT NULL AUTO_INCREMENT,
        \`target_user_id\`   VARCHAR(36)      NOT NULL COMMENT 'User A (유지할 계정)',
        \`source_user_id\`   VARCHAR(36)      NOT NULL COMMENT 'User B (삭제될 계정)',
        \`provider\`         ENUM('homepage','google','naver') NOT NULL,
        \`provider_id\`      VARCHAR(255)  NOT NULL,
        \`status\`           ENUM(
          'PENDING_EMAIL_VERIFICATION','EMAIL_VERIFIED','IN_PROGRESS',
          'STEP1_AUTH_BACKUP','STEP2_AUTHZ_MERGE','STEP3_MYPICK_MERGE',
          'STEP4_USER_DELETE','STEP5_CACHE_INVALIDATE',
          'COMPLETED','FAILED','COMPENSATING','COMPENSATED','CANCELLED'
        ) NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
        \`error_message\`    TEXT          NULL,
        \`retry_count\`      INT           NOT NULL DEFAULT 0,
        \`email_verified_at\` DATETIME    NULL,
        \`completed_at\`     DATETIME     NULL,
        \`created_at\`       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\`       DATETIME(6)  NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_ACCOUNT_MERGE_TARGET_USER_ID\` (\`target_user_id\`),
        INDEX \`IDX_ACCOUNT_MERGE_SOURCE_USER_ID\` (\`source_user_id\`),
        INDEX \`IDX_ACCOUNT_MERGE_STATUS\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`account_merge\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`oauth_account\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`user\``);
  }
}
