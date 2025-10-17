import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { API_CONFIG } from './config/api.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes
  app.setGlobalPrefix(API_CONFIG.PREFIX);

  // Configure API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_CONFIG.VERSION,
    prefix: API_CONFIG.VERSION_PREFIX,
  });

  // Enable validation pipes globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(`API Base URL: /${API_CONFIG.PREFIX}/v${API_CONFIG.VERSION}`);
}
bootstrap();
