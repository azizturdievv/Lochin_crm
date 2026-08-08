import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// Butun ilova bo'ylab ushlanmagan xatolarni tutadi. Maqsad ikkita:
// 1) Har qanday kutilmagan xato (bug, DB uzilishi va h.k.) serverda to'liq
//    stack bilan loglansin — hozirgacha bunday xatolar hech qayerda
//    izlanmasdi, faqat NestJS'ning sukut bo'yicha generik 500'i qaytardi.
// 2) Mijozga hech qachon xom xato xabari (masalan DB ustun nomi, fayl yo'li)
//    chiqib ketmasin — HttpException (bilib turib tashlangan, masalan
//    NotFoundException/BadRequestException) o'z shaklida qaytadi, qolgan
//    barcha xatolar uchun umumiy, xavfsiz xabar qaytariladi.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // 5xx bo'lgan HttpException'lar ham (masalan servis ichida qo'lda
      // tashlangan) serverda loglanadi — 4xx (validatsiya, ruxsat va h.k.)
      // oddiy holat, log kerak emas
      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} — ${status}: ${exception.message}`,
          exception.stack,
        );
      }

      response.status(status).json(
        typeof body === 'string'
          ? { statusCode: status, message: body }
          : body,
      );
      return;
    }

    // Kutilmagan xato — to'liq stack server logida, mijozga xavfsiz umumiy xabar
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`${request.method} ${request.url} — 500: ${err.message}`, err.stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Ichki server xatosi yuz berdi. Muammo davom etsa, administratorga murojaat qiling.',
      error: 'Internal Server Error',
    });
  }
}
