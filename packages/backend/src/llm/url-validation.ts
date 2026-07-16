import { BadRequestException } from '@nestjs/common';

// Private/LAN addresses are intentionally allowed: this is a local-first tool and
// LM Studio / Ollama on localhost or the LAN is the primary use case (see SECURITY.md).
// Cloud instance-metadata endpoints are never a legitimate LLM endpoint, though.
const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal', 'metadata.goog']);

export function assertValidEndpointUrl(endpointUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    throw new BadRequestException(`endpointUrl is not a valid URL: ${endpointUrl}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('endpointUrl must use http:// or https://');
  }
  if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new BadRequestException('endpointUrl points to a blocked host');
  }
}
