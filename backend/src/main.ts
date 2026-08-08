import { NestFactory, Reflector } from '@nestjs/core';
import { types } from 'pg';

// BigInt ni JSON sifatida yuborish uchun (NestJS JSON.stringify chaqiradi)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.valueOf().toString();
};

// "timestamp without time zone" ustunlari (createdAt/updatedAt) DB'da UTC sifatida
// saqlanadi, lekin `pg` standart holatda buni server mahalliy vaqti deb talqin qiladi —
// server UTC+5'da ishlagani uchun bu har bir sanani 5 soatga noto'g'ri suradi.
// OID 1114 = timestamp without time zone — qiymatni aniq UTC deb belgilaymiz.
types.setTypeParser(1114, (str) => new Date(str + 'Z'));

import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS sozlamalari
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  });

  // Global xato ushlagich — barcha ushlanmagan xatolar shu yerdan o'tadi
  app.useGlobalFilters(new GlobalExceptionFilter());

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

  console.log(`✅ Lochin School CRM server ishga tushdi: http://localhost:${port}`);
  console.log(`📊 Ma'lumotlar bazasi: ${process.env.DB_NAME ?? 'ilm_crm'}`);
  console.log(`🔐 JWT + 2FA himoya faol`);
}

bootstrap();
