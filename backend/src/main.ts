import { NestFactory, Reflector } from '@nestjs/core';

// BigInt ni JSON sifatida yuborish uchun (NestJS JSON.stringify chaqiradi)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.valueOf().toString();
};
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS sozlamalari
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  });

  // Global validatsiya
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.APP_PORT ?? 3000;
  await app.listen(port);

  console.log(`✅ Ilm Academy CRM server ishga tushdi: http://localhost:${port}`);
  console.log(`📊 Ma'lumotlar bazasi: ${process.env.DB_NAME ?? 'ilm_crm'}`);
  console.log(`🔐 JWT + 2FA himoya faol`);
}

bootstrap();
