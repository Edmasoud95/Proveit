import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

// Custom body parser that reads raw UTF-8 bytes and JSON.parses them,
// bypassing body-parser's iconv-lite dependency (causes EPERM on macOS Desktop).
function rawJsonParser(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
    return next();
  }
  const ct = req.headers['content-type'] ?? '';
  if (!ct.includes('application/json') && !ct.includes('text/')) {
    return next();
  }
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf-8');
    if (raw) {
      try {
        (req as Request & { body: unknown }).body = JSON.parse(raw);
      } catch {
        (req as Request & { body: unknown }).body = {};
      }
    }
    next();
  });
  req.on('error', next);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(rawJsonParser);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: /^http:\/\/localhost:\d+$/ });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Proveit backend running on http://localhost:${port}/api`);
}

bootstrap();
