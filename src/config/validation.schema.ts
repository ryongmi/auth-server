import Joi from 'joi';

const defaultConfigSchema = {
  NODE_ENV: Joi.string().valid('local', 'development', 'production').required(),
  PORT: Joi.number().default(8000),
  CORS_ORIGINS: Joi.string().required(),
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
  JWT_REFRESH_STORE_NAME: Joi.string().required(),
  JWT_BLACKLIST_STORE_NAME: Joi.string().required(),
  JWT_NAVER_STATE_STORE_NAME: Joi.string().required(),
  JWT_GOOGLE_STATE_STORE_NAME: Joi.string().required(),
};

export const validationSchema = Joi.object({
  ...defaultConfigSchema,
  ...mysqlConfigSchema,
  ...redisConfigSchema,
  ...googleConfigSchema,
  ...naverConfigSchema,
  ...jwtConfigSchema,
});
