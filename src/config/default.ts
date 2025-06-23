export default (): {
  mode: string | undefined;
  port: number;
  corsOrigins: string | undefined;
} => ({
  mode: process.env.NODE_ENV,
  port: parseInt(process.env.PORT ?? '8000', 10),
  corsOrigins: process.env.CORS_ORIGINS,
});
