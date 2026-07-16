import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

// Maximum accepted request body. Largest legitimate payloads are POC config
// updates with tool definitions — well under 1 MB.
const MAX_BODY_BYTES = 1024 * 1024;

// Custom body parser that reads raw UTF-8 bytes and JSON.parses them,
// bypassing body-parser's iconv-lite dependency (causes EPERM on macOS Desktop).
// Do not replace with express.json() without verifying that issue is gone.
function rawJsonParser(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
    return next();
  }
  const ct = req.headers['content-type'] ?? '';
  if (!ct.includes('application/json') && !ct.includes('text/')) {
    return next();
  }
  const chunks: Buffer[] = [];
  let received = 0;
  let aborted = false;
  req.on('data', (chunk: Buffer) => {
    if (aborted) return;
    received += chunk.length;
    if (received > MAX_BODY_BYTES) {
      aborted = true;
      res.status(413).json({ statusCode: 413, message: 'Request body too large' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    const raw = Buffer.concat(chunks).toString('utf-8');
    if (raw) {
      try {
        (req as Request & { body: unknown }).body = JSON.parse(raw);
      } catch {
        res.status(400).json({ statusCode: 400, message: 'Invalid JSON in request body' });
        return;
      }
    }
    next();
  });
  req.on('error', next);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(helmet());
  app.use(rawJsonParser);
  app.setGlobalPrefix('api');
  // Any localhost port: the Vite dev server picks a fallback port when 5173 is taken.
  app.enableCors({ origin: /^http:\/\/localhost:\d+$/ });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Proveit backend running on http://localhost:${port}/api`);
}

bootstrap();
