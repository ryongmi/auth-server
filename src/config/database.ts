import { registerAs } from '@nestjs/config';

export const mysqlConfig = registerAs('db-mysql', () => ({
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT ?? '8000', 10),
  username: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  name: process.env.MYSQL_DATABASE,
  synchronize: process.env.NODE_ENV !== 'production', // 개발 환경에서는 true, 프로덕션 환경에서는 false로 설정
  logging: process.env.NODE_ENV !== 'production',
}));

export const redisConfig = registerAs('db-redis', () => ({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT ?? '8000', 10),
  password: process.env.REDIS_PASSWORD,
}));
