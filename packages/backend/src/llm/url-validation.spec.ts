import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { assertValidEndpointUrl } from './url-validation';

describe('assertValidEndpointUrl', () => {
  it('accepts localhost http URLs (LM Studio default)', () => {
    expect(() => assertValidEndpointUrl('http://localhost:1234/v1')).not.toThrow();
  });

  it('accepts LAN and public https URLs', () => {
    expect(() => assertValidEndpointUrl('http://192.168.1.10:11434/v1')).not.toThrow();
    expect(() => assertValidEndpointUrl('https://api.openai.com/v1')).not.toThrow();
  });

  it('rejects malformed URLs', () => {
    expect(() => assertValidEndpointUrl('not-a-url')).toThrow(BadRequestException);
    expect(() => assertValidEndpointUrl('')).toThrow(BadRequestException);
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => assertValidEndpointUrl('ftp://example.com')).toThrow(BadRequestException);
    expect(() => assertValidEndpointUrl('file:///etc/passwd')).toThrow(BadRequestException);
    expect(() => assertValidEndpointUrl('gopher://example.com')).toThrow(BadRequestException);
  });

  it('rejects cloud metadata hosts regardless of case or path', () => {
    expect(() => assertValidEndpointUrl('http://169.254.169.254/latest/meta-data')).toThrow(
      BadRequestException,
    );
    expect(() => assertValidEndpointUrl('http://metadata.google.internal/computeMetadata')).toThrow(
      BadRequestException,
    );
    expect(() => assertValidEndpointUrl('http://METADATA.GOOGLE.INTERNAL/x')).toThrow(
      BadRequestException,
    );
  });
});
