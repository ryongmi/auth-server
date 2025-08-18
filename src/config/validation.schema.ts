import Joi from 'joi';

const defaultConfigSchema = {
  NODE_ENV: Joi.string().valid('local', 'development', 'production').required(),
  PORT: Joi.number().required(),
  TCP_PORT: Joi.number().required(),
  CORS_ORIGINS: Joi.string().required(),
  AUTH_CLIENT_URL: Joi.string().required(),
  OAUTH_REDIRECT_SESSION_STORE_NAME: Joi.string().required(),
  ALLOWED_REDIRECT_DOMAINS: Joi.string().required(),
  ALLOWED_REDIRECT_PROTOCOLS: Joi.string().required(),
};

const clientConfigSchema = {
  AUTHZ_SERVICE_HOST: Joi.string().default('authz-server'),
  AUTHZ_SERVICE_PORT: Joi.number().default(8110),
  PORTAL_SERVICE_HOST: Joi.string().default('portal-server'),
  PORTAL_SERVICE_PORT: Joi.number().default(8210),
};

const mysqlConfigSchema = {
  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().required(),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().required(),
  MYSQL_DATABASE: Joi.string().required(),
};

const redisConfigSchema = {
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
  REDIS_PASSWORD: Joi.string().required(),
};

const googleConfigSchema = {
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_REDIRECT_URL: Joi.string().required(),
  GOOGLE_TOKEN_URL: Joi.string().required(),
  GOOGLE_USERINFO_URL: Joi.string().required(),
};

const naverConfigSchema = {
  NAVER_CLIENT_ID: Joi.string().required(),
  NAVER_CLIENT_SECRET: Joi.string().required(),
  NAVER_REDIRECT_URL: Joi.string().required(),
  NAVER_TOKEN_URL: Joi.string().required(),
  NAVER_USERINFO_URL: Joi.string().required(),
};

const jwtConfigSchema = {
  JWT_ACCESS_PRIVATE_KEY_PATH: Joi.string().required(),
  JWT_ACCESS_PUBLIC_KEY_PATH: Joi.string().required(),
  JWT_REFRESH_PRIVATE_KEY_PATH: Joi.string().required(),
  JWT_REFRESH_PUBLIC_KEY_PATH: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
  JWT_SESSION_COOKIE_PATH: Joi.string().required(),
  JWT_REFRESH_MAX_AGE: Joi.number().required(),
  JWT_COOKIE_DOMAIN: Joi.string().allow('').optional(),
  JWT_COOKIE_DOMAIN_DEV: Joi.string().allow('').optional(),
  JWT_REFRESH_STORE_NAME: Joi.string().required(),
  JWT_BLACKLIST_STORE_NAME: Joi.string().required(),
  JWT_NAVER_STATE_STORE_NAME: Joi.string().required(),
  JWT_GOOGLE_STATE_STORE_NAME: Joi.string().required(),
};

export const validationSchema = Joi.object({
  ...defaultConfigSchema,
  ...clientConfigSchema,
  ...mysqlConfigSchema,
  ...redisConfigSchema,
  ...googleConfigSchema,
  ...naverConfigSchema,
  ...jwtConfigSchema,
});
