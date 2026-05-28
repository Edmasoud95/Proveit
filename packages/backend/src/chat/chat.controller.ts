import { Controller, Post, Param, Body, BadRequestException, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';
import type { ChatMessageInput } from '@proveit/shared';

class ChatStreamDto {
  messages!: ChatMessageInput[];
}

@Controller('pocs/:id/chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('stream')
  @Sse()
  stream(@Param('id') pocId: string, @Body() body: ChatStreamDto): Observable<MessageEvent> {
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new BadRequestException('messages must be a non-empty array');
    }
    return this.chatService.streamChat(pocId, body.messages);
  }
}
